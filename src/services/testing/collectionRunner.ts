import {
  ApiRequest,
  ApiResponse,
  EnvironmentVariable,
  IterationDataRow,
  RequestExecutionOptions,
  RunnerConfig,
  RunnerProgressState,
  RunnerRequestExecutionResult,
  ScriptVariableUpdates,
} from '../../types';
import { runSingleRequestPipeline } from './testRunner';

/**
 * Parses CSV text (with support for quoted commas and escaped quotes) into IterationDataRow[].
 */
export function parseCsvIterationData(csvText: string): IterationDataRow[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const splitCsvRow = (row: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = splitCsvRow(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (headers.length === 0) return [];

  const rows: IterationDataRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const values = splitCsvRow(lines[r]);
    const rowObj: IterationDataRow = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] ?? '';
    });
    rows.push(rowObj);
  }
  return rows;
}

/**
 * Parses JSON iteration data (either array of objects or single object wrapped as 1 row).
 */
export function parseJsonIterationData(jsonText: string): IterationDataRow[] {
  const parsed = JSON.parse(jsonText);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row: IterationDataRow = {};
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        row[k] = v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      }
      return row;
    });
}

function applyVarUpdatesInMemory(
  vars: EnvironmentVariable[],
  updates: Record<string, string | null>,
  scope: EnvironmentVariable['scope']
): EnvironmentVariable[] {
  const next = [...vars];
  for (const [key, value] of Object.entries(updates)) {
    const idx = next.findIndex((v) => v.key === key);
    if (value === null) {
      if (idx !== -1) next.splice(idx, 1);
    } else if (idx !== -1) {
      next[idx] = { ...next[idx], currentValue: value, enabled: true };
    } else {
      next.push({
        id: `run-${scope}-${key}-${Date.now()}`,
        key,
        initialValue: value,
        currentValue: value,
        description: 'Updated during collection run',
        enabled: true,
        isSecret: false,
        scope,
      });
    }
  }
  return next;
}

export interface CollectionRunnerController {
  pause: () => void;
  resume: () => void;
  stop: () => void;
  getStatus: () => RunnerProgressState['status'];
}

export interface RunCollectionOptions {
  config: RunnerConfig;
  requestLookup: Record<string, ApiRequest>;
  environmentVariables?: EnvironmentVariable[];
  collectionVariables?: EnvironmentVariable[];
  globalVariables?: EnvironmentVariable[];
  resolveSchemaById?: (schemaId: string) => Promise<string | undefined>;
  httpExecutor?: (req: ApiRequest, opts: RequestExecutionOptions) => Promise<ApiResponse>;
  onProgress?: (progress: RunnerProgressState) => void;
  onResult?: (result: RunnerRequestExecutionResult) => void;
  onVariableUpdates?: (updates: ScriptVariableUpdates) => Promise<void> | void;
  controllerRef?: (ctrl: CollectionRunnerController) => void;
}

export async function runCollectionPipeline(options: RunCollectionOptions): Promise<{
  progress: RunnerProgressState;
  results: RunnerRequestExecutionResult[];
}> {
  const { config, requestLookup } = options;
  const enabledSelections = [...config.requests]
    .filter((r) => r.enabled)
    .sort((a, b) => a.order - b.order);

  const dataRows = config.iterationData || [];
  const totalIterations = Math.max(1, config.iterations || (dataRows.length > 0 ? dataRows.length : 1));
  const totalExecutions = enabledSelections.length * totalIterations;

  const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const startedAt = Date.now();

  let status: RunnerProgressState['status'] = 'running';
  let paused = false;
  let stopped = false;
  let activeRequestCancel: (() => void) | null = null;
  let resumeWaiter: (() => void) | null = null;

  const progress: RunnerProgressState = {
    runId,
    status: 'running',
    totalExecutions,
    completedExecutions: 0,
    currentIteration: 1,
    totalIterations,
    currentRequestIndex: 0,
    passedRequests: 0,
    failedRequests: 0,
    passedAssertions: 0,
    failedAssertions: 0,
    skippedAssertions: 0,
    elapsedMs: 0,
    startedAt,
    percentage: totalExecutions === 0 ? 100 : 0,
  };

  const emitProgress = () => {
    progress.elapsedMs = Date.now() - startedAt;
    progress.percentage =
      totalExecutions === 0
        ? 100
        : Math.min(100, Math.round((progress.completedExecutions / totalExecutions) * 100));
    options.onProgress?.({ ...progress });
  };

  const controller: CollectionRunnerController = {
    pause: () => {
      if (status === 'running') {
        paused = true;
        status = 'paused';
        progress.status = 'paused';
        emitProgress();
      }
    },
    resume: () => {
      if (paused && !stopped) {
        paused = false;
        status = 'running';
        progress.status = 'running';
        emitProgress();
        if (resumeWaiter) {
          const fn = resumeWaiter;
          resumeWaiter = null;
          fn();
        }
      }
    },
    stop: () => {
      stopped = true;
      paused = false;
      status = 'stopped';
      progress.status = 'stopped';
      if (activeRequestCancel) {
        activeRequestCancel();
      }
      if (resumeWaiter) {
        const fn = resumeWaiter;
        resumeWaiter = null;
        fn();
      }
      emitProgress();
    },
    getStatus: () => status,
  };

  options.controllerRef?.(controller);
  emitProgress();

  const waitIfPaused = async () => {
    while (paused && !stopped) {
      await new Promise<void>((resolve) => {
        resumeWaiter = resolve;
      });
    }
  };

  const sleepWithStop = async (ms: number) => {
    if (ms <= 0 || stopped) return;
    const step = 25;
    let remaining = ms;
    while (remaining > 0 && !stopped) {
      await new Promise((r) => setTimeout(r, Math.min(step, remaining)));
      remaining -= step;
    }
  };

  let envVars = [...(options.environmentVariables || [])];
  let colVars = [...(options.collectionVariables || [])];
  let globVars = [...(options.globalVariables || [])];
  const results: RunnerRequestExecutionResult[] = [];

  outerLoop: for (let iter = 1; iter <= totalIterations; iter++) {
    const iterRow = dataRows.length > 0 ? dataRows[(iter - 1) % dataRows.length] : undefined;

    for (let idx = 0; idx < enabledSelections.length; idx++) {
      await waitIfPaused();
      if (stopped) break outerLoop;

      const sel = enabledSelections[idx];
      const req = requestLookup[sel.requestId];
      if (!req) continue;

      progress.currentIteration = iter;
      progress.currentRequestIndex = idx + 1;
      progress.currentRequestName = req.name;
      emitProgress();

      const execRef = {
        cancel: () => {},
      };
      activeRequestCancel = () => execRef.cancel();

      const pipelineOut = await runSingleRequestPipeline({
        request: req,
        tabId: `${runId}-iter${iter}-${req.id}`,
        environmentVariables: envVars,
        collectionVariables: colVars,
        globalVariables: globVars,
        iterationData: iterRow,
        extraAssertions: config.extraAssertions,
        resolveSchemaById: options.resolveSchemaById,
        httpExecutor: options.httpExecutor,
        timeoutMs: config.timeoutMs || req.settings?.timeout,
        executionRef: execRef,
      });

      activeRequestCancel = null;

      // Apply variable updates forward for sequential chaining
      envVars = applyVarUpdatesInMemory(envVars, pipelineOut.variableUpdates.environment, 'environment');
      colVars = applyVarUpdatesInMemory(colVars, pipelineOut.variableUpdates.collectionVariables, 'collection');
      globVars = applyVarUpdatesInMemory(globVars, pipelineOut.variableUpdates.globals, 'global');

      if (options.onVariableUpdates) {
        await options.onVariableUpdates(pipelineOut.variableUpdates);
      }

      if (stopped) break outerLoop;

      const passedTests = pipelineOut.tests.filter((t) => t.status !== 'failed' && t.status !== 'skipped' && t.passed).length;
      const failedTests = pipelineOut.tests.filter((t) => t.status === 'failed' || !t.passed).length;
      const skippedTests = pipelineOut.tests.filter((t) => t.status === 'skipped').length;

      if (pipelineOut.passed) progress.passedRequests += 1;
      else progress.failedRequests += 1;

      progress.passedAssertions += passedTests;
      progress.failedAssertions += failedTests;
      progress.skippedAssertions += skippedTests;
      progress.completedExecutions += 1;

      const execResult: RunnerRequestExecutionResult = {
        id: `rres-${runId}-${iter}-${idx}-${req.id}`,
        iteration: iter,
        order: idx + 1,
        requestId: req.id,
        requestName: req.name,
        method: req.method,
        resolvedUrl: pipelineOut.response.url || req.url,
        status: pipelineOut.response.status,
        statusText: pipelineOut.response.statusText,
        responseTimeMs: pipelineOut.response.timeMs,
        sizeBytes: pipelineOut.response.sizeBytes ?? pipelineOut.response.size ?? 0,
        passed: pipelineOut.passed,
        failedReason: pipelineOut.passed
          ? undefined
          : pipelineOut.scriptError?.message ||
            pipelineOut.response.error?.message ||
            pipelineOut.tests.find((t) => !t.passed)?.error ||
            'Assertion failed',
        scriptError: pipelineOut.scriptError,
        tests: pipelineOut.tests,
        assertions: pipelineOut.assertionResults,
        schemaValidation: pipelineOut.schemaValidation,
        consoleLogs: pipelineOut.consoleLogs,
        iterationDataRow: iterRow,
        timestamp: Date.now(),
      };

      results.push(execResult);
      options.onResult?.(execResult);
      emitProgress();

      if (!pipelineOut.passed && config.failureMode === 'stop') {
        break outerLoop;
      }

      const isLastItem = iter === totalIterations && idx === enabledSelections.length - 1;
      if (!isLastItem && config.delayMs > 0) {
        await sleepWithStop(config.delayMs);
      }
    }
  }

  progress.finishedAt = Date.now();
  progress.elapsedMs = progress.finishedAt - startedAt;
  progress.status = stopped ? 'stopped' : 'completed';
  progress.percentage = stopped ? progress.percentage : 100;
  status = progress.status;
  emitProgress();

  return { progress, results };
}
