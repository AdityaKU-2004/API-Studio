import { create } from 'zustand';
import {
  ApiRequest,
  CollectionItem,
  FailureHandlingMode,
  IterationDataFormat,
  IterationDataRow,
  RunnerConfig,
  RunnerProgressState,
  RunnerRequestExecutionResult,
  RunnerRequestSelection,
  TestSuite,
} from '../types';
import {
  CollectionRunnerController,
  parseCsvIterationData,
  parseJsonIterationData,
  runCollectionPipeline,
} from '../services/testing/collectionRunner';
import { buildTestReport } from '../services/testing/testReportService';
import { persistScriptVariableUpdates } from '../services/scripting/variablePersistence';
import { useCollectionStore } from './collectionStore';
import { useEnvironmentStore } from './environmentStore';
import { useVariableStore } from './variableStore';
import { useTestingStore } from './testingStore';
import { useReportStore } from './reportStore';
import { useTestSuiteStore } from './testSuiteStore';

interface RunnerState {
  config: RunnerConfig;
  sourceType: 'collection' | 'folder' | 'suite' | 'custom';
  sourceId?: string;
  sourceName: string;
  progress: RunnerProgressState | null;
  results: RunnerRequestExecutionResult[];
  lastReportId: string | null;
  dataParseError: string | null;
  controller: CollectionRunnerController | null;

  loadFromCollection: (collectionId: string, folderId?: string) => void;
  loadFromSuite: (suite: TestSuite) => void;
  updateConfig: (updates: Partial<RunnerConfig>) => void;
  toggleRequestSelection: (requestId: string, enabled: boolean) => void;
  moveRequestOrder: (requestId: string, direction: 'up' | 'down') => void;
  importIterationData: (rawText: string, format: IterationDataFormat) => boolean;
  clearIterationData: () => void;

  startRun: () => Promise<void>;
  pauseRun: () => void;
  resumeRun: () => void;
  stopRun: () => void;
  restartRun: () => Promise<void>;
  resetResults: () => void;
}

function flattenCollectionRequests(
  items: CollectionItem[],
  targetCollectionId?: string,
  targetFolderId?: string
): { selections: RunnerRequestSelection[]; lookup: Record<string, ApiRequest>; name: string } {
  const selections: RunnerRequestSelection[] = [];
  const lookup: Record<string, ApiRequest> = {};
  let sourceName = 'Workspace Requests';

  const walk = (nodes: CollectionItem[], inTargetCol: boolean, inTargetFolder: boolean) => {
    for (const node of nodes) {
      if (node.type === 'collection') {
        const matchCol = !targetCollectionId || node.id === targetCollectionId;
        if (matchCol && targetCollectionId && !targetFolderId) {
          sourceName = node.name;
        }
        if (matchCol && node.children) {
          walk(node.children, true, !targetFolderId);
        }
      } else if (node.type === 'folder') {
        const matchFld = inTargetFolder || (inTargetCol && node.id === targetFolderId);
        if (inTargetCol && node.id === targetFolderId) {
          sourceName = node.name;
        }
        if (node.children) {
          walk(node.children, inTargetCol, matchFld);
        }
      } else if (node.type === 'request' && node.request) {
        if (inTargetCol && inTargetFolder) {
          lookup[node.request.id] = node.request;
          selections.push({
            requestId: node.request.id,
            collectionId: node.collectionId || node.request.collectionId,
            folderId: node.request.folderId,
            name: node.request.name,
            method: node.request.method,
            url: node.request.url,
            enabled: true,
            order: selections.length + 1,
          });
        }
      }
    }
  };

  walk(items, !targetCollectionId, !targetFolderId);
  return { selections, lookup, name: sourceName };
}

const DEFAULT_CONFIG: RunnerConfig = {
  requests: [],
  environmentId: null,
  iterations: 1,
  delayMs: 0,
  failureMode: 'continue' as FailureHandlingMode,
  timeoutMs: 10000,
  iterationData: [],
};

export const useRunnerStore = create<RunnerState>((set, get) => ({
  config: DEFAULT_CONFIG,
  sourceType: 'collection',
  sourceName: 'Select a Collection',
  progress: null,
  results: [],
  lastReportId: null,
  dataParseError: null,
  controller: null,

  loadFromCollection: (collectionId, folderId) => {
    const colStore = useCollectionStore.getState();
    const envId = useEnvironmentStore.getState().activeEnvironmentId;
    const { selections, name } = flattenCollectionRequests(colStore.collections, collectionId, folderId);

    set({
      sourceType: folderId ? 'folder' : 'collection',
      sourceId: folderId || collectionId,
      sourceName: name,
      progress: null,
      results: [],
      lastReportId: null,
      dataParseError: null,
      config: {
        ...DEFAULT_CONFIG,
        collectionId,
        folderId,
        environmentId: envId,
        requests: selections,
      },
    });
  },

  loadFromSuite: (suite) => {
    const colStore = useCollectionStore.getState();
    const { lookup } = flattenCollectionRequests(colStore.collections);
    const selections: RunnerRequestSelection[] = [];
    for (const reqId of suite.requestIds) {
      const req = lookup[reqId] || colStore.findRequestById(reqId);
      if (req) {
        selections.push({
          requestId: req.id,
          collectionId: req.collectionId,
          folderId: req.folderId,
          name: req.name,
          method: req.method,
          url: req.url,
          enabled: true,
          order: selections.length + 1,
        });
      }
    }

    set({
      sourceType: 'suite',
      sourceId: suite.id,
      sourceName: suite.name,
      progress: null,
      results: [],
      lastReportId: null,
      dataParseError: null,
      config: {
        id: suite.id,
        name: suite.name,
        collectionId: suite.collectionId,
        requests: selections,
        environmentId: suite.environmentId,
        iterations: suite.iterations || 1,
        delayMs: suite.delayMs || 0,
        failureMode: suite.failureMode || 'continue',
        timeoutMs: suite.timeoutMs || 10000,
        iterationData: suite.iterationData || [],
        extraAssertions: suite.assertions || [],
      },
    });
  },

  updateConfig: (updates) => {
    set((s) => ({
      config: { ...s.config, ...updates },
    }));
  },

  toggleRequestSelection: (requestId, enabled) => {
    set((s) => ({
      config: {
        ...s.config,
        requests: s.config.requests.map((r) =>
          r.requestId === requestId ? { ...r, enabled } : r
        ),
      },
    }));
  },

  moveRequestOrder: (requestId, direction) => {
    set((s) => {
      const list = [...s.config.requests].sort((a, b) => a.order - b.order);
      const idx = list.findIndex((r) => r.requestId === requestId);
      if (idx === -1) return s;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return s;

      const tmp = list[idx];
      list[idx] = list[targetIdx];
      list[targetIdx] = tmp;

      const reindexed = list.map((item, i) => ({ ...item, order: i + 1 }));
      return {
        config: { ...s.config, requests: reindexed },
      };
    });
  },

  importIterationData: (rawText, format) => {
    try {
      const rows: IterationDataRow[] =
        format === 'csv' ? parseCsvIterationData(rawText) : parseJsonIterationData(rawText);
      if (rows.length === 0) {
        set({ dataParseError: `No valid data rows found in ${format.toUpperCase()} input.` });
        return false;
      }
      set((s) => ({
        dataParseError: null,
        config: {
          ...s.config,
          iterationData: rows,
          iterationDataFormat: format,
          iterations: Math.max(s.config.iterations, rows.length),
        },
      }));
      return true;
    } catch (err) {
      set({
        dataParseError: err instanceof Error ? err.message : `Invalid ${format.toUpperCase()} data`,
      });
      return false;
    }
  },

  clearIterationData: () => {
    set((s) => ({
      dataParseError: null,
      config: { ...s.config, iterationData: [], iterationDataFormat: undefined },
    }));
  },

  startRun: async () => {
    const state = get();
    if (state.progress?.status === 'running' || state.progress?.status === 'paused') {
      return;
    }

    const colStore = useCollectionStore.getState();
    const envStore = useEnvironmentStore.getState();
    const globVars = useVariableStore.getState().globalVariables;
    const { lookup } = flattenCollectionRequests(colStore.collections);

    // Ensure any sample/collection request is resolvable
    for (const sel of state.config.requests) {
      if (!lookup[sel.requestId]) {
        const found = colStore.findRequestById(sel.requestId);
        if (found) lookup[sel.requestId] = found;
      }
    }

    const selectedEnv = envStore.environments.find((e) => e.id === state.config.environmentId);
    const parentCol = state.config.collectionId
      ? colStore.collections.find((c) => c.id === state.config.collectionId)
      : undefined;

    set({ results: [], lastReportId: null });

    const { progress, results } = await runCollectionPipeline({
      config: state.config,
      requestLookup: lookup,
      environmentVariables: selectedEnv?.variables || [],
      collectionVariables: parentCol?.variables || [],
      globalVariables: globVars,
      resolveSchemaById: async (schemaId) => {
        return useTestingStore.getState().getSchemaById(schemaId)?.schemaText;
      },
      controllerRef: (ctrl) => set({ controller: ctrl }),
      onProgress: (p) => set({ progress: p }),
      onResult: (res) => set((s) => ({ results: [...s.results, res] })),
      onVariableUpdates: async (updates) => {
        await persistScriptVariableUpdates(updates, {
          environmentId: state.config.environmentId,
          collectionId: state.config.collectionId,
        });
      },
    });

    // Build & persist Test Report
    const report = buildTestReport({
      name: `${state.sourceName} — ${new Date(progress.startedAt).toLocaleTimeString()}`,
      sourceType: state.sourceType,
      sourceId: state.sourceId,
      sourceName: state.sourceName,
      environmentId: state.config.environmentId,
      environmentName: selectedEnv?.name || 'No Environment',
      progress,
      results,
      secretSources: [selectedEnv?.variables, parentCol?.variables, globVars],
    });

    await useReportStore.getState().saveReport(report);

    if (state.sourceType === 'suite' && state.sourceId) {
      const suiteStatus = report.status === 'passed' ? 'passed' : 'failed';
      await useTestSuiteStore.getState().updateSuite(state.sourceId, {
        lastRunReportId: report.id,
        lastRunStatus: suiteStatus,
        lastRunAt: report.finishedAt,
      });
    }

    set({ progress, results, lastReportId: report.id, controller: null });
  },

  pauseRun: () => {
    get().controller?.pause();
  },

  resumeRun: () => {
    get().controller?.resume();
  },

  stopRun: () => {
    get().controller?.stop();
  },

  restartRun: async () => {
    const ctrl = get().controller;
    if (ctrl && (ctrl.getStatus() === 'running' || ctrl.getStatus() === 'paused')) {
      ctrl.stop();
      await new Promise((r) => setTimeout(r, 50));
    }
    set({ progress: null, results: [], lastReportId: null });
    await get().startRun();
  },

  resetResults: () => {
    set({ progress: null, results: [], lastReportId: null });
  },
}));
