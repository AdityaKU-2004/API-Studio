import { create } from 'zustand';
import { ApiResponse, ConsoleLogEntry, TabExecutionState, ExecutionStatus } from '../types';
import { httpClient } from '../services/http/httpClient';

const scrubSecretTokens = (text?: string): string | undefined => {
  if (!text) return text;
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1••••••')
    .replace(/(Basic\s+)[A-Za-z0-9+/=]+/gi, '$1••••••')
    .replace(/(api[-_]?key|token|secret|password)\s*[:=]\s*([^\s,;]+)/gi, '$1: ••••••');
};

interface ExecutionState {
  tabExecutions: Record<string, TabExecutionState>;
  tabResponses: Record<string, ApiResponse | null>;
  logs: ConsoleLogEntry[];
  isConsoleOpen: boolean;

  // Actions
  startExecution: (tabId: string, requestId: string) => void;
  updateExecutionStatus: (
    tabId: string,
    status: ExecutionStatus,
    progressMessage?: string
  ) => void;
  finishExecution: (tabId: string, response: ApiResponse) => void;
  cancelExecution: (tabId: string) => void;
  setTabResponse: (tabId: string, response: ApiResponse | null) => void;
  getTabExecution: (tabId: string) => TabExecutionState;
  getTabResponse: (tabId: string) => ApiResponse | null;

  // Console actions
  addLog: (log: Omit<ConsoleLogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  exportLogs: (format?: 'json' | 'text') => string;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  tabExecutions: {},
  tabResponses: {},
  logs: [],
  isConsoleOpen: false,

  startExecution: (tabId, requestId) => {
    set((state) => ({
      tabExecutions: {
        ...state.tabExecutions,
        [tabId]: {
          tabId,
          requestId,
          status: 'sending',
          executionId: 'exec-' + Date.now(),
          startTime: Date.now(),
          progressMessage: 'Connecting...',
        },
      },
    }));
  },

  updateExecutionStatus: (tabId, status, progressMessage) => {
    set((state) => {
      const current = state.tabExecutions[tabId] || {
        tabId,
        requestId: '',
        status: 'idle',
        executionId: null,
      };

      return {
        tabExecutions: {
          ...state.tabExecutions,
          [tabId]: {
            ...current,
            status,
            progressMessage,
          },
        },
      };
    });
  },

  finishExecution: (tabId, response) => {
    const isError = response.status === 0 || !!response.error;
    const finalStatus: ExecutionStatus = isError
      ? response.error?.type === 'abort'
        ? 'cancelled'
        : response.error?.type === 'timeout'
        ? 'timed_out'
        : 'failed'
      : 'completed';

    set((state) => {
      const current = state.tabExecutions[tabId];
      return {
        tabExecutions: {
          ...state.tabExecutions,
          [tabId]: {
            ...(current || { tabId, requestId: response.requestId, executionId: response.id }),
            status: finalStatus,
            progressMessage: undefined,
          },
        },
        tabResponses: {
          ...state.tabResponses,
          [tabId]: response,
        },
      };
    });
  },

  cancelExecution: (tabId) => {
    httpClient.cancel(tabId);
    set((state) => {
      const current = state.tabExecutions[tabId];
      if (!current) return state;

      return {
        tabExecutions: {
          ...state.tabExecutions,
          [tabId]: {
            ...current,
            status: 'cancelled',
            progressMessage: 'Cancelled',
          },
        },
      };
    });
  },

  setTabResponse: (tabId, response) => {
    set((state) => ({
      tabResponses: {
        ...state.tabResponses,
        [tabId]: response,
      },
    }));
  },

  getTabExecution: (tabId) => {
    return (
      get().tabExecutions[tabId] || {
        tabId,
        requestId: '',
        status: 'idle',
        executionId: null,
      }
    );
  },

  getTabResponse: (tabId) => {
    return get().tabResponses[tabId] || null;
  },

  addLog: (log) => {
    const entry: ConsoleLogEntry = {
      ...log,
      category: log.category || 'http',
      message: scrubSecretTokens(log.message) || log.message,
      details: scrubSecretTokens(log.details),
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
    };

    set((state) => ({
      // Keep up to 300 console logs
      logs: [entry, ...state.logs].slice(0, 300),
    }));
  },

  clearLogs: () => set({ logs: [] }),
  exportLogs: (format = 'json') => {
    const logs = get().logs;
    if (format === 'text') {
      return logs
        .map(
          (l) =>
            `[${new Date(l.timestamp).toISOString()}] [${(l.category || 'http').toUpperCase()}] [${l.level.toUpperCase()}] ${l.title}: ${l.message}${
              l.durationMs !== undefined ? ` (${l.durationMs}ms)` : ''
            }`
        )
        .join('\n');
    }
    return JSON.stringify(logs, null, 2);
  },
  toggleConsole: () => set((s) => ({ isConsoleOpen: !s.isConsoleOpen })),
  setConsoleOpen: (open) => set({ isConsoleOpen: open }),
}));
