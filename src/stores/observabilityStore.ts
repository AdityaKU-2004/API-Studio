import { create } from 'zustand';
import {
  ObservabilityErrorCategory,
  RedactionConfig,
  RequestTraceEntry,
} from '../types';
import {
  buildTraceFromHistoryEntry,
  DEFAULT_REDACTION_CONFIG,
} from '../services/observability/observabilityService';
import { useHistoryStore } from './historyStore';
import { useCollectionStore } from './collectionStore';
import { useEnvironmentStore } from './environmentStore';

interface ObservabilityState {
  redactionConfig: RedactionConfig;
  selectedTraceId: string | null;
  hostFilter: string;
  statusFilter: 'all' | '2xx' | '4xx' | '5xx' | 'error';
  errorCategoryFilter: ObservabilityErrorCategory | 'all';

  setRedactionConfig: (updates: Partial<RedactionConfig>) => void;
  selectTrace: (traceId: string | null) => void;
  setHostFilter: (host: string) => void;
  setStatusFilter: (filter: 'all' | '2xx' | '4xx' | '5xx' | 'error') => void;
  setErrorCategoryFilter: (cat: ObservabilityErrorCategory | 'all') => void;
  getTraces: () => RequestTraceEntry[];
}

export const useObservabilityStore = create<ObservabilityState>((set, get) => ({
  redactionConfig: DEFAULT_REDACTION_CONFIG,
  selectedTraceId: null,
  hostFilter: '',
  statusFilter: 'all',
  errorCategoryFilter: 'all',

  setRedactionConfig: (updates) =>
    set((s) => ({
      redactionConfig: { ...s.redactionConfig, ...updates },
    })),

  selectTrace: (traceId) => set({ selectedTraceId: traceId }),
  setHostFilter: (hostFilter) => set({ hostFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setErrorCategoryFilter: (errorCategoryFilter) => set({ errorCategoryFilter }),

  getTraces: () => {
    const history = useHistoryStore.getState().history;
    const collections = useCollectionStore.getState().collections;
    const activeEnv = useEnvironmentStore
      .getState()
      .environments.find(
        (e) => e.id === useEnvironmentStore.getState().activeEnvironmentId
      );
    const { redactionConfig, hostFilter, statusFilter, errorCategoryFilter } = get();

    const colNames = new Map<string, string>();
    for (const c of collections) {
      if (c.type === 'collection') colNames.set(c.id, c.name);
    }

    const traces = history.map((h) => {
      const colName = h.request?.collectionId
        ? colNames.get(h.request.collectionId)
        : undefined;
      return buildTraceFromHistoryEntry(h, colName, activeEnv?.name, redactionConfig);
    });

    return traces.filter((tr) => {
      if (hostFilter && !tr.host.toLowerCase().includes(hostFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter === '2xx' && (tr.statusCode < 200 || tr.statusCode >= 300)) {
        return false;
      }
      if (statusFilter === '4xx' && (tr.statusCode < 400 || tr.statusCode >= 500)) {
        return false;
      }
      if (statusFilter === '5xx' && tr.statusCode < 500) {
        return false;
      }
      if (statusFilter === 'error' && tr.errorCategory === 'none') {
        return false;
      }
      if (
        errorCategoryFilter !== 'all' &&
        tr.errorCategory !== errorCategoryFilter
      ) {
        return false;
      }
      return true;
    });
  },
}));
