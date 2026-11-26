import { create } from 'zustand';
import {
  ApiRequest,
  PerformanceMetricSample,
  PerformanceTestConfig,
  PerformanceTestRun,
} from '../types';
import { db } from '../database/database';
import {
  cancelPerformanceTest,
  runPerformanceTest,
} from '../services/performance/performanceEngine';
import { useEnvironmentStore } from './environmentStore';

interface PerformanceState {
  configs: PerformanceTestConfig[];
  runs: PerformanceTestRun[];
  samplesByRun: Record<string, PerformanceMetricSample[]>;
  liveSamples: PerformanceMetricSample[];
  activeRunId: string | null;
  isRunning: boolean;
  error: string | null;
  abortController: AbortController | null;

  loadPerformanceData: () => Promise<void>;
  saveConfig: (config: PerformanceTestConfig) => Promise<void>;
  deleteConfig: (configId: string) => Promise<void>;
  selectRun: (runId: string) => void;
  deleteRun: (runId: string) => Promise<void>;
  startRun: (config: PerformanceTestConfig, targetRequests: ApiRequest[]) => Promise<PerformanceTestRun>;
  stopActiveRun: () => Promise<void>;
}

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  configs: [],
  runs: [],
  samplesByRun: {},
  liveSamples: [],
  activeRunId: null,
  isRunning: false,
  error: null,
  abortController: null,

  loadPerformanceData: async () => {
    const [configs, runs, allMetrics] = await Promise.all([
      db.performanceTestConfigs.orderBy('updatedAt').reverse().toArray(),
      db.performanceTestRuns.orderBy('startedAt').reverse().toArray(),
      db.performanceMetrics.toArray(),
    ]);

    const samplesByRun: Record<string, PerformanceMetricSample[]> = {};
    for (const m of allMetrics) {
      if (!samplesByRun[m.runId]) samplesByRun[m.runId] = [];
      samplesByRun[m.runId].push(m);
    }
    for (const list of Object.values(samplesByRun)) {
      list.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
    }

    set({
      configs,
      runs,
      samplesByRun,
      activeRunId: get().activeRunId || runs[0]?.id || null,
    });
  },

  saveConfig: async (config) => {
    const updated = { ...config, updatedAt: Date.now() };
    await db.performanceTestConfigs.put(updated);
    const configs = await db.performanceTestConfigs.orderBy('updatedAt').reverse().toArray();
    set({ configs });
  },

  deleteConfig: async (configId) => {
    await db.performanceTestConfigs.delete(configId);
    set((s) => ({ configs: s.configs.filter((c) => c.id !== configId) }));
  },

  selectRun: (runId) => set({ activeRunId: runId }),

  deleteRun: async (runId) => {
    await db.performanceTestRuns.delete(runId);
    await db.performanceMetrics.where('runId').equals(runId).delete();
    set((s) => {
      const runs = s.runs.filter((r) => r.id !== runId);
      const nextSamples = { ...s.samplesByRun };
      delete nextSamples[runId];
      return {
        runs,
        samplesByRun: nextSamples,
        activeRunId: s.activeRunId === runId ? runs[0]?.id || null : s.activeRunId,
      };
    });
  },

  startRun: async (config, targetRequests) => {
    const runId = `prun-${Date.now()}`;
    const abortController = new AbortController();
    const resolvedVariables = useEnvironmentStore.getState().getResolvedVariables();

    set({
      isRunning: true,
      error: null,
      liveSamples: [],
      activeRunId: runId,
      abortController,
    });

    try {
      const { run, samples } = await runPerformanceTest({
        runId,
        config,
        targetRequests,
        resolvedVariables,
        signal: abortController.signal,
        onSample: (sample) => {
          set((s) => ({ liveSamples: [...s.liveSamples, sample] }));
        },
      });

      await db.performanceTestRuns.put(run);
      if (samples.length > 0) {
        await db.performanceMetrics.bulkPut(samples);
      }

      set((s) => ({
        isRunning: false,
        abortController: null,
        runs: [run, ...s.runs],
        samplesByRun: { ...s.samplesByRun, [run.id]: samples },
        activeRunId: run.id,
      }));
      return run;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Performance test failed';
      set({ isRunning: false, abortController: null, error: msg });
      throw err;
    }
  },

  stopActiveRun: async () => {
    const { activeRunId, abortController } = get();
    if (activeRunId) {
      await cancelPerformanceTest(activeRunId, abortController ?? undefined);
    }
  },
}));
