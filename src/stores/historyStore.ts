import { create } from 'zustand';
import { HistoryItem, HistoryFilterOptions, ApiRequest } from '../types';
import { initialHistory } from '../data/mockData';
import { historyRepository } from '../repositories/historyRepository';

interface HistoryState {
  history: HistoryItem[];
  isLoading: boolean;
  selectedHistoryItem: HistoryItem | null;
  retentionLimit: number;
  retainResponseBody: boolean;

  loadHistory: () => Promise<void>;
  addHistoryItem: (item: Omit<HistoryItem, 'id'>) => Promise<string>;
  deleteHistoryItem: (id: string) => Promise<void>;
  deleteBatchHistory: (ids: string[]) => Promise<void>;
  clearHistory: () => Promise<void>;
  setSelectedHistoryItem: (item: HistoryItem | null) => void;
  setRetentionLimit: (limit: number) => void;
  setRetainResponseBody: (retain: boolean) => void;
  getFilteredHistory: (filters: HistoryFilterOptions) => HistoryItem[];
}

function sanitizeRequestForHistory(req: ApiRequest): ApiRequest {
  const sanitized = JSON.parse(JSON.stringify(req)) as ApiRequest;

  // Mask sensitive auth values
  if (sanitized.auth) {
    if (sanitized.auth.type === 'bearer' && sanitized.auth.bearer) {
      sanitized.auth.bearer.token = '';
    } else if (sanitized.auth.type === 'basic' && sanitized.auth.basic) {
      sanitized.auth.basic.password = '';
    } else if (sanitized.auth.type === 'apikey') {
      const apiKey = sanitized.auth.apikey || sanitized.auth.apiKey;
      if (apiKey) apiKey.value = '••••••••';
    } else if (sanitized.auth.type === 'oauth2' && sanitized.auth.oauth2) {
      sanitized.auth.oauth2.token = '';
      sanitized.auth.oauth2.accessToken = '';
      sanitized.auth.oauth2.clientSecret = '';
    }
  }

  // Scrub authorization headers
  if (sanitized.headers) {
    sanitized.headers = sanitized.headers.map((h) => {
      const lower = h.key.toLowerCase();
      if (lower.includes('auth') || lower.includes('token') || lower.includes('secret')) {
        return { ...h, value: '••••••••' };
      }
      return h;
    });
  }

  // Strip binary bodies
  if (sanitized.body?.binary) {
    sanitized.body.binary = {
      fileName: sanitized.body.binary.fileName || sanitized.body.binary.filename,
    };
  }

  return sanitized;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: initialHistory,
  isLoading: false,
  selectedHistoryItem: null,
  retentionLimit: 50,
  retainResponseBody: true,

  loadHistory: async () => {
    set({ isLoading: true });
    try {
      const list = await historyRepository.getAll();
      if (list.length > 0) {
        set({ history: list, isLoading: false });
      } else {
        set({ history: initialHistory, isLoading: false });
      }
    } catch {
      set({ history: initialHistory, isLoading: false });
    }
  },

  addHistoryItem: async (item) => {
    const sanitizedRequest = sanitizeRequestForHistory(item.request);
    const id = 'hist-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newEntry: HistoryItem = {
      ...item,
      id,
      request: sanitizedRequest,
    };

    const { retentionLimit, retainResponseBody } = get();
    await historyRepository.add(newEntry, retentionLimit, retainResponseBody);
    await get().loadHistory();
    return id;
  },

  deleteHistoryItem: async (id) => {
    await historyRepository.delete(id);
    await get().loadHistory();
  },

  deleteBatchHistory: async (ids) => {
    await historyRepository.deleteBatch(ids);
    await get().loadHistory();
  },

  clearHistory: async () => {
    await historyRepository.clear();
    set({ history: [], selectedHistoryItem: null });
  },

  setSelectedHistoryItem: (item) => set({ selectedHistoryItem: item }),
  setRetentionLimit: (limit) => set({ retentionLimit: Math.max(10, Math.min(200, limit)) }),
  setRetainResponseBody: (retain) => set({ retainResponseBody: retain }),

  getFilteredHistory: (filters) => {
    const { history } = get();
    return history
      .filter((item) => {
        // 1. Search Query
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchUrl = item.url.toLowerCase().includes(q);
          const matchName = (item.requestName || item.request?.name || '').toLowerCase().includes(q);
          if (!matchUrl && !matchName) return false;
        }

        // 2. Method Filter
        if (filters.method !== 'ALL' && item.method !== filters.method) {
          return false;
        }

        // 3. Status Code Category Filter
        if (filters.statusCodeCategory !== 'ALL') {
          if (filters.statusCodeCategory === 'ERR' && (item.status === 0 || item.executionResult === 'error')) {
            return true;
          }
          if (filters.statusCodeCategory === '2xx' && item.status >= 200 && item.status < 300) return true;
          if (filters.statusCodeCategory === '3xx' && item.status >= 300 && item.status < 400) return true;
          if (filters.statusCodeCategory === '4xx' && item.status >= 400 && item.status < 500) return true;
          if (filters.statusCodeCategory === '5xx' && item.status >= 500 && item.status < 600) return true;
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'newest') return b.timestamp - a.timestamp;
        if (filters.sortBy === 'oldest') return a.timestamp - b.timestamp;
        if (filters.sortBy === 'fastest') return a.timeMs - b.timeMs;
        if (filters.sortBy === 'slowest') return b.timeMs - a.timeMs;
        return 0;
      });
  },
}));
