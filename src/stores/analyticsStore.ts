import { create } from 'zustand';
import { AnalyticsSnapshot, UnifiedReportItem } from '../types';
import { db } from '../database/database';
import {
  buildAnalyticsSnapshot,
  collectUnifiedReports,
} from '../services/analytics/analyticsService';
import { useHistoryStore } from './historyStore';
import { useReportStore } from './reportStore';
import { useContractStore } from './contractStore';
import { usePerformanceStore } from './performanceStore';
import { useSecurityAuditStore } from './securityAuditStore';
import { useMonitoringStore } from './monitoringStore';
import { useWorkflowStore } from './workflowStore';

interface AnalyticsState {
  snapshots: AnalyticsSnapshot[];
  currentSnapshot: AnalyticsSnapshot | null;
  unifiedReports: UnifiedReportItem[];

  refreshAnalytics: () => Promise<void>;
  deleteReportItem: (item: UnifiedReportItem) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  snapshots: [],
  currentSnapshot: null,
  unifiedReports: [],

  refreshAnalytics: async () => {
    const history = useHistoryStore.getState().history;
    const testReports = useReportStore.getState().reports;
    const contractReports = useContractStore.getState().reports;
    const performanceRuns = usePerformanceStore.getState().runs;
    const securityFindings = useSecurityAuditStore.getState().findings;
    const monitoringResults = useMonitoringStore.getState().results;
    const workflowExecutions = useWorkflowStore.getState().executions;

    const currentSnapshot = buildAnalyticsSnapshot({
      history,
      testReports,
      contractReports,
      performanceRuns,
      securityFindings,
      monitoringResults,
      workflowExecutions,
    });

    const unifiedReports = collectUnifiedReports({
      testReports,
      contractReports,
      performanceRuns,
      securityFindings,
      monitoringResults,
      workflowExecutions,
    });

    await db.analyticsSnapshots.put(currentSnapshot).catch(() => {});
    const snapshots = await db.analyticsSnapshots
      .orderBy('generatedAt')
      .reverse()
      .limit(30)
      .toArray()
      .catch(() => [currentSnapshot]);

    set({ currentSnapshot, snapshots, unifiedReports });
  },

  deleteReportItem: async (item) => {
    const raw = item.rawPayload as { id?: string } | undefined;
    const targetId = raw?.id;
    if (item.kind === 'test' && targetId) {
      await useReportStore.getState().deleteReport(targetId);
    } else if (item.kind === 'contract' && targetId) {
      await useContractStore.getState().deleteReport(targetId);
    } else if (item.kind === 'performance' && targetId) {
      await usePerformanceStore.getState().deleteRun(targetId);
    } else if (item.kind === 'workflow' && targetId) {
      await db.workflowExecutions.delete(targetId);
      await useWorkflowStore.getState().loadWorkflows();
    } else if (item.kind === 'monitoring') {
      await db.monitoringResults.clear();
      await useMonitoringStore.getState().loadMonitors();
    } else if (item.kind === 'security') {
      await db.securityFindings.clear();
      await useSecurityAuditStore.getState().loadSecurityAudits();
    }
    await useAnalyticsStore.getState().refreshAnalytics();
  },
}));
