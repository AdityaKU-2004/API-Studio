import { create } from 'zustand';
import { ContractEndpointResult, ContractTestReport, OpenApiParsedDoc } from '../types';
import { db } from '../database/database';
import { runContractTestSuite } from '../services/contract/contractTester';
import { useEnvironmentStore } from './environmentStore';

interface ContractState {
  reports: ContractTestReport[];
  activeReport: ContractTestReport | null;
  liveResults: ContractEndpointResult[];
  isRunning: boolean;
  progress: { current: number; total: number };
  stopRequested: boolean;
  isLoaded: boolean;

  loadReports: () => Promise<void>;
  selectReport: (reportId: string) => void;
  deleteReport: (reportId: string) => Promise<void>;
  runContractSuite: (params: {
    specId: string;
    parsedDoc: OpenApiParsedDoc;
    baseUrl: string;
    endpointIds?: string[];
    strictNoAdditionalProperties?: boolean;
  }) => Promise<ContractTestReport>;
  stopRun: () => void;
}

export const useContractStore = create<ContractState>((set, get) => ({
  reports: [],
  activeReport: null,
  liveResults: [],
  isRunning: false,
  progress: { current: 0, total: 0 },
  stopRequested: false,
  isLoaded: false,

  loadReports: async () => {
    const reports = await db.contractReports.orderBy('startedAt').reverse().toArray();
    set({
      reports,
      activeReport: get().activeReport || reports[0] || null,
      isLoaded: true,
    });
  },

  selectReport: (reportId) => {
    const found = get().reports.find((r) => r.id === reportId) || null;
    set({ activeReport: found });
  },

  deleteReport: async (reportId) => {
    await db.contractReports.delete(reportId);
    set((s) => {
      const remaining = s.reports.filter((r) => r.id !== reportId);
      return {
        reports: remaining,
        activeReport: s.activeReport?.id === reportId ? remaining[0] || null : s.activeReport,
      };
    });
  },

  runContractSuite: async ({
    specId,
    parsedDoc,
    baseUrl,
    endpointIds,
    strictNoAdditionalProperties,
  }) => {
    const envState = useEnvironmentStore.getState();
    const activeEnv = envState.environments.find((e) => e.id === envState.activeEnvironmentId);
    const resolvedVariables: Record<string, string> = {};
    if (activeEnv) {
      for (const v of activeEnv.variables) {
        if (v.enabled && v.key) {
          resolvedVariables[v.key] = v.currentValue || v.initialValue || '';
        }
      }
    }

    set({
      isRunning: true,
      stopRequested: false,
      liveResults: [],
      progress: { current: 0, total: endpointIds?.length || parsedDoc.endpoints.length },
    });

    const report = await runContractTestSuite({
      specId,
      parsedDoc,
      baseUrl,
      environmentName: activeEnv?.name,
      resolvedVariables,
      endpointIds,
      strictNoAdditionalProperties,
      shouldStop: () => get().stopRequested,
      onProgress: (result, index, total) => {
        set((s) => ({
          liveResults: [...s.liveResults, result],
          progress: { current: index, total },
        }));
      },
    });

    await db.contractReports.put(report);
    set((s) => ({
      isRunning: false,
      reports: [report, ...s.reports],
      activeReport: report,
    }));
    return report;
  },

  stopRun: () => set({ stopRequested: true }),
}));
