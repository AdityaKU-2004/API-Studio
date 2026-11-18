import { create } from 'zustand';
import { TestReport } from '../types';
import { testReportRepository } from '../repositories/testReportRepository';

interface ReportState {
  reports: TestReport[];
  selectedReportId: string | null;
  retentionLimit: number;
  isLoading: boolean;

  loadReports: () => Promise<void>;
  selectReport: (id: string | null) => void;
  saveReport: (report: TestReport) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  clearReports: () => Promise<void>;
  setRetentionLimit: (limit: number) => Promise<void>;
}

const getStoredRetention = (): number => {
  try {
    const val = localStorage.getItem('api_studio_report_retention');
    return val ? Math.max(5, Number(JSON.parse(val))) : 50;
  } catch {
    return 50;
  }
};

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  selectedReportId: null,
  retentionLimit: getStoredRetention(),
  isLoading: false,

  loadReports: async () => {
    set({ isLoading: true });
    try {
      const reports = await testReportRepository.getAll(get().retentionLimit);
      set({
        reports,
        selectedReportId:
          get().selectedReportId && reports.some((r) => r.id === get().selectedReportId)
            ? get().selectedReportId
            : reports[0]?.id || null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  selectReport: (id) => set({ selectedReportId: id }),

  saveReport: async (report) => {
    await testReportRepository.save(report, get().retentionLimit);
    await get().loadReports();
    set({ selectedReportId: report.id });
  },

  deleteReport: async (id) => {
    await testReportRepository.delete(id);
    await get().loadReports();
  },

  clearReports: async () => {
    await testReportRepository.clearAll();
    set({ reports: [], selectedReportId: null });
  },

  setRetentionLimit: async (limit) => {
    const clamped = Math.max(5, Math.min(500, limit));
    try {
      localStorage.setItem('api_studio_report_retention', JSON.stringify(clamped));
    } catch {
      // ignore
    }
    set({ retentionLimit: clamped });
    await testReportRepository.enforceRetention(clamped);
    await get().loadReports();
  },
}));
