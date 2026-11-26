import { create } from 'zustand';
import {
  ApiRequest,
  OpenApiSpecRecord,
  SecurityAuditConfig,
  SecurityAuditReport,
  SecurityFinding,
  SecurityFindingStatus,
} from '../types';
import { db } from '../database/database';
import { runSecurityAudit } from '../services/security/securityAuditor';
import { useEnvironmentStore } from './environmentStore';

interface SecurityAuditState {
  configs: SecurityAuditConfig[];
  findings: SecurityFinding[];
  latestReport: SecurityAuditReport | null;
  isAuditing: boolean;
  error: string | null;

  loadSecurityAudits: () => Promise<void>;
  saveConfig: (config: SecurityAuditConfig) => Promise<void>;
  executeAudit: (params: {
    config: SecurityAuditConfig;
    requests: ApiRequest[];
    specs: OpenApiSpecRecord[];
  }) => Promise<SecurityAuditReport>;
  updateFindingStatus: (
    findingId: string,
    status: SecurityFindingStatus,
    notes?: string
  ) => Promise<void>;
  deleteFinding: (findingId: string) => Promise<void>;
}

export const useSecurityAuditStore = create<SecurityAuditState>((set, get) => ({
  configs: [],
  findings: [],
  latestReport: null,
  isAuditing: false,
  error: null,

  loadSecurityAudits: async () => {
    const [configs, findings] = await Promise.all([
      db.securityAuditConfigs.orderBy('updatedAt').reverse().toArray(),
      db.securityFindings.orderBy('detectedAt').reverse().toArray(),
    ]);
    set({ configs, findings });
  },

  saveConfig: async (config) => {
    const saved = { ...config, updatedAt: Date.now() };
    await db.securityAuditConfigs.put(saved);
    const configs = await db.securityAuditConfigs.orderBy('updatedAt').reverse().toArray();
    set({ configs });
  },

  executeAudit: async ({ config, requests, specs }) => {
    set({ isAuditing: true, error: null });
    try {
      const resolvedVariables = useEnvironmentStore.getState().getResolvedVariables();
      await get().saveConfig(config);
      const report = await runSecurityAudit({
        config,
        requests,
        specs,
        resolvedVariables,
      });

      if (report.findings.length > 0) {
        await db.securityFindings.bulkPut(report.findings);
      }

      const findings = await db.securityFindings.orderBy('detectedAt').reverse().toArray();
      set({ isAuditing: false, latestReport: report, findings });
      return report;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Security audit failed';
      set({ isAuditing: false, error: msg });
      throw err;
    }
  },

  updateFindingStatus: async (findingId, status, notes) => {
    const target = get().findings.find((f) => f.id === findingId);
    if (!target) return;
    const updated: SecurityFinding = {
      ...target,
      status,
      notes: notes !== undefined ? notes : target.notes,
    };
    await db.securityFindings.put(updated);
    set((s) => ({
      findings: s.findings.map((f) => (f.id === findingId ? updated : f)),
      latestReport: s.latestReport
        ? {
            ...s.latestReport,
            findings: s.latestReport.findings.map((f) =>
              f.id === findingId ? updated : f
            ),
          }
        : null,
    }));
  },

  deleteFinding: async (findingId) => {
    await db.securityFindings.delete(findingId);
    set((s) => ({
      findings: s.findings.filter((f) => f.id !== findingId),
    }));
  },
}));
