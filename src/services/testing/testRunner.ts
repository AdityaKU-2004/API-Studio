import {
  ApiRequest,
  ApiResponse,
  AssertionResult,
  AssertionRule,
  EnvironmentVariable,
  IterationDataRow,
  RequestExecutionOptions,
  SchemaValidationResult,
  ScriptConsoleEntry,
  ScriptExecutionError,
  ScriptExecutionResult,
  ScriptVariableUpdates,
  TestResult,
} from '../../types';
import { httpClient } from '../http/httpClient';
import { buildScriptExecutionContext } from '../scripting/scriptContext';
import { scriptExecutor } from '../scripting/scriptExecutor';
import { assertionEngine } from './assertionEngine';
import { schemaValidator } from './schemaValidator';

export interface RunSingleRequestPipelineInput {
  request: ApiRequest;
  tabId?: string;
  environmentVariables?: EnvironmentVariable[];
  collectionVariables?: EnvironmentVariable[];
  folderVariables?: EnvironmentVariable[];
  globalVariables?: EnvironmentVariable[];
  iterationData?: IterationDataRow;
  extraAssertions?: AssertionRule[];
  resolveSchemaById?: (schemaId: string) => Promise<string | undefined>;
  httpExecutor?: (req: ApiRequest, opts: RequestExecutionOptions) => Promise<ApiResponse>;
  timeoutMs?: number;
  scriptTimeoutMs?: number;
  executionRef?: { cancel: () => void };
}

export interface SingleRequestPipelineOutput {
  abortedBeforeRequest?: boolean;
  preRequestResult?: ScriptExecutionResult;
  postResponseResult?: ScriptExecutionResult;
  response: ApiResponse;
  assertionResults: AssertionResult[];
  schemaValidation?: SchemaValidationResult;
  consoleLogs: ScriptConsoleEntry[];
  tests: TestResult[];
  variableUpdates: ScriptVariableUpdates;
  scriptError?: ScriptExecutionError;
  passed: boolean;
}

function mergeVariableUpdates(
  base: ScriptVariableUpdates,
  incoming: ScriptVariableUpdates
): ScriptVariableUpdates {
  return {
    environment: { ...base.environment, ...incoming.environment },
    collectionVariables: { ...base.collectionVariables, ...incoming.collectionVariables },
    globals: { ...base.globals, ...incoming.globals },
    variables: { ...base.variables, ...incoming.variables },
  };
}

function applyUpdatesToVarList(
  vars: EnvironmentVariable[],
  updates: Record<string, string | null>,
  scope: EnvironmentVariable['scope']
): EnvironmentVariable[] {
  const map = new Map<string, EnvironmentVariable>();
  for (const v of vars) {
    map.set(v.key, { ...v });
  }
  for (const [k, val] of Object.entries(updates)) {
    if (val === null) {
      map.delete(k);
    } else if (map.has(k)) {
      const existing = map.get(k)!;
      map.set(k, { ...existing, currentValue: val, enabled: true });
    } else {
      map.set(k, {
        id: `dyn-${scope}-${k}-${Date.now()}`,
        key: k,
        initialValue: val,
        currentValue: val,
        description: 'Set by script',
        enabled: true,
        isSecret: false,
        scope,
      });
    }
  }
  return Array.from(map.values());
}

function buildResolvedVarMap(params: {
  globals: EnvironmentVariable[];
  collectionVars: EnvironmentVariable[];
  folderVars: EnvironmentVariable[];
  envVars: EnvironmentVariable[];
  requestVars: EnvironmentVariable[];
  iterationData?: IterationDataRow;
}): Record<string, string> {
  const merged: Record<string, string> = {};
  const addList = (list: EnvironmentVariable[]) => {
    for (const v of list) {
      if (v.enabled !== false && v.key?.trim()) {
        merged[v.key.trim()] = v.currentValue ?? v.initialValue ?? '';
      }
    }
  };
  addList(params.globals);
  addList(params.collectionVars);
  addList(params.folderVars);
  addList(params.envVars);
  if (params.iterationData) {
    for (const [k, v] of Object.entries(params.iterationData)) {
      merged[k] = String(v);
    }
  }
  addList(params.requestVars);
  return merged;
}

export async function runSingleRequestPipeline(
  input: RunSingleRequestPipelineInput
): Promise<SingleRequestPipelineOutput> {
  const { request, tabId, extraAssertions = [] } = input;
  let envVars = [...(input.environmentVariables || [])];
  let colVars = [...(input.collectionVariables || [])];
  const folderVars = [...(input.folderVariables || [])];
  let globVars = [...(input.globalVariables || [])];
  let localVars = [...(request.variables || [])];

  let aggregatedUpdates: ScriptVariableUpdates = {
    environment: {},
    collectionVariables: {},
    globals: {},
    variables: {},
  };

  const consoleLogs: ScriptConsoleEntry[] = [];
  const allTests: TestResult[] = [];
  let activeScriptExecId: string | undefined;
  let cancelledExternally = false;

  if (input.executionRef) {
    input.executionRef.cancel = () => {
      cancelledExternally = true;
      if (activeScriptExecId) {
        scriptExecutor.cancel(activeScriptExecId);
      }
      if (tabId) {
        httpClient.cancel(tabId);
      }
    };
  }

  // 1. Pre-request Script Execution
  const preScriptCode =
    request.scripts?.preRequest?.enabled !== false
      ? request.scripts?.preRequest?.script ?? request.preRequestScript ?? ''
      : '';
  const preFailurePolicy = request.scripts?.preRequest?.failurePolicy ?? 'halt';

  let preRequestResult: ScriptExecutionResult | undefined;

  if (preScriptCode.trim()) {
    const preCtx = buildScriptExecutionContext({
      stage: 'pre-request',
      request,
      environmentVariables: envVars,
      collectionVariables: colVars,
      globalVariables: globVars,
      localVariables: localVars,
      iterationData: input.iterationData,
      timeoutMs: input.scriptTimeoutMs ?? 3000,
    });

    activeScriptExecId = `pre-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    preRequestResult = await scriptExecutor.execute(preScriptCode, preCtx, activeScriptExecId);
    activeScriptExecId = undefined;

    consoleLogs.push(...preRequestResult.logs);
    aggregatedUpdates = mergeVariableUpdates(aggregatedUpdates, preRequestResult.variableUpdates);

    envVars = applyUpdatesToVarList(envVars, preRequestResult.variableUpdates.environment, 'environment');
    colVars = applyUpdatesToVarList(colVars, preRequestResult.variableUpdates.collectionVariables, 'collection');
    globVars = applyUpdatesToVarList(globVars, preRequestResult.variableUpdates.globals, 'global');
    localVars = applyUpdatesToVarList(localVars, preRequestResult.variableUpdates.variables, 'request');

    if (!preRequestResult.success && preRequestResult.error) {
      if (preFailurePolicy === 'halt' || preRequestResult.cancelled || cancelledExternally) {
        const errResp: ApiResponse = {
          id: `exec-abort-${Date.now()}`,
          requestId: request.id,
          status: 0,
          statusText: 'PRE-REQUEST SCRIPT ERROR',
          ok: false,
          url: request.url,
          method: request.method,
          headers: {},
          body: JSON.stringify(
            {
              stage: 'pre-request',
              error: preRequestResult.error,
            },
            null,
            2
          ),
          rawBody: preRequestResult.error.message,
          contentType: 'application/json',
          contentTypeCategory: 'json',
          size: 0,
          sizeBytes: 0,
          timeMs: preRequestResult.durationMs,
          timing: {
            startTime: Date.now(),
            endTime: Date.now() + preRequestResult.durationMs,
            duration: preRequestResult.durationMs,
            prepareMs: preRequestResult.durationMs,
            waitingMs: 0,
            downloadMs: 0,
          },
          receivedAt: new Date().toISOString(),
          timestamp: Date.now(),
          cookies: [],
          tests: [
            {
              id: `pre-err-${Date.now()}`,
              name: 'Pre-request Script',
              passed: false,
              status: 'failed',
              error: preRequestResult.error.line
                ? `Line ${preRequestResult.error.line}: ${preRequestResult.error.message}`
                : preRequestResult.error.message,
              durationMs: preRequestResult.durationMs,
              source: 'script',
            },
          ],
          scriptLogs: consoleLogs,
          scriptError: preRequestResult.error,
        };
        return {
          abortedBeforeRequest: true,
          preRequestResult,
          response: errResp,
          assertionResults: [],
          consoleLogs,
          tests: errResp.tests,
          variableUpdates: aggregatedUpdates,
          scriptError: preRequestResult.error,
          passed: false,
        };
      }
    }
  }

  // 2. Resolve variables cleanly (including pre-request mutations) & execute HTTP
  const resolvedVariables = buildResolvedVarMap({
    globals: globVars,
    collectionVars: colVars,
    folderVars,
    envVars,
    requestVars: localVars,
    iterationData: input.iterationData,
  });

  const executor = input.httpExecutor || ((req, opts) => httpClient.execute(req, opts));
  const response = await executor(request, {
    tabId,
    resolvedVariables,
    timeoutMs: input.timeoutMs ?? request.settings?.timeout,
    skipScripts: true,
  });

  // 3. Post-response Script Execution
  const postScriptCode =
    request.scripts?.postResponse?.enabled !== false
      ? request.scripts?.postResponse?.script ?? request.testScript ?? ''
      : '';

  let postResponseResult: ScriptExecutionResult | undefined;
  let scriptError: ScriptExecutionError | undefined = preRequestResult?.error;

  if (postScriptCode.trim() && !cancelledExternally && response.error?.type !== 'abort') {
    const postCtx = buildScriptExecutionContext({
      stage: 'post-response',
      request,
      response,
      environmentVariables: envVars,
      collectionVariables: colVars,
      globalVariables: globVars,
      localVariables: localVars,
      iterationData: input.iterationData,
      timeoutMs: input.scriptTimeoutMs ?? 3000,
    });

    activeScriptExecId = `post-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    postResponseResult = await scriptExecutor.execute(postScriptCode, postCtx, activeScriptExecId);
    activeScriptExecId = undefined;

    consoleLogs.push(...postResponseResult.logs);
    aggregatedUpdates = mergeVariableUpdates(aggregatedUpdates, postResponseResult.variableUpdates);

    for (const outcome of postResponseResult.tests) {
      allTests.push({
        id: outcome.id,
        name: outcome.name,
        passed: outcome.passed,
        status: outcome.status,
        message: outcome.error,
        error: outcome.error,
        expected: outcome.expected,
        actual: outcome.actual,
        durationMs: outcome.durationMs,
        source: 'script',
      });
    }

    if (!postResponseResult.success && postResponseResult.error) {
      scriptError = postResponseResult.error;
      allTests.push({
        id: `post-err-${Date.now()}`,
        name: 'Post-response Script Execution',
        passed: false,
        status: 'failed',
        message: postResponseResult.error.message,
        error: postResponseResult.error.line
          ? `Line ${postResponseResult.error.line}: ${postResponseResult.error.message}`
          : postResponseResult.error.message,
        durationMs: postResponseResult.durationMs,
        source: 'script',
      });
    }
  }

  // 4. Automated No-Code Assertions
  const combinedRules = [...(request.assertions || []), ...extraAssertions];
  const assertionSummary = assertionEngine.evaluate(combinedRules, response);
  for (const a of assertionSummary.results) {
    allTests.push({
      id: a.id,
      name: a.name,
      passed: a.status !== 'failed',
      status: a.status,
      error: a.error,
      message: a.error,
      expected: a.expected,
      actual: a.actual,
      durationMs: a.durationMs,
      source: 'assertion',
      group: a.group,
    });
  }

  // 5. JSON Schema Validation
  let schemaValidation: SchemaValidationResult | undefined;
  if (request.schemaValidation?.enabled) {
    let schemaText = request.schemaValidation.inlineSchema;
    let schemaName = 'Inline JSON Schema';
    if (!schemaText && request.schemaValidation.schemaId && input.resolveSchemaById) {
      schemaText = await input.resolveSchemaById(request.schemaValidation.schemaId);
      schemaName = `Schema (${request.schemaValidation.schemaId})`;
    }
    if (schemaText && schemaText.trim()) {
      schemaValidation = schemaValidator.validateResponse(response, schemaText, schemaName);
      allTests.push({
        id: `schema-${Date.now()}`,
        name: `JSON Schema Validation (${schemaValidation.schemaName || 'Response'})`,
        passed: schemaValidation.valid,
        status: schemaValidation.valid ? 'passed' : 'failed',
        error: schemaValidation.valid
          ? undefined
          : schemaValidation.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
        expected: 'Valid against JSON Schema',
        actual: schemaValidation.valid
          ? 'Valid'
          : `${schemaValidation.errorCount} schema violation(s)`,
        durationMs: schemaValidation.durationMs,
        source: 'schema',
      });
    }
  }

  response.tests = allTests;
  response.scriptLogs = consoleLogs;
  response.scriptError = scriptError;
  response.schemaValidation = schemaValidation;

  const hasNetworkErr = response.status === 0 || Boolean(response.error);
  const hasFailedTest = allTests.some((t) => t.status === 'failed' || !t.passed);
  const passed = !hasNetworkErr && !hasFailedTest && !scriptError;

  return {
    abortedBeforeRequest: false,
    preRequestResult,
    postResponseResult,
    response,
    assertionResults: assertionSummary.results,
    schemaValidation,
    consoleLogs,
    tests: allTests,
    variableUpdates: aggregatedUpdates,
    scriptError,
    passed,
  };
}
