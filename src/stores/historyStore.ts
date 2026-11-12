import { create } from 'zustand';
import { HistoryItem, ApiRequest } from '../types';
import { initialHistory } from '../data/mockData';

interface HistoryState {
  history: HistoryItem[];
  retentionLimit: number;
  addHistoryItem: (item: Omit<HistoryItem, 'id'>) => void;
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;
  setRetentionLimit: (limit: number) => void;
}

/**
 * Sanitizes an ApiRequest to strip out sensitive secrets and excessive binary data before storing in history.
 */
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
    sanitized.body.binary = { fileName: sanitized.body.binary.fileName || sanitized.body.binary.filename };
  }

  return sanitized;
}

const STORAGE_KEY = 'api_studio_history_v1';

function loadStoredHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Fall back to initial mock history
  }
  return initialHistory;
}

function persistHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded or restricted
  }
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: loadStoredHistory(),
  retentionLimit: 50,

  addHistoryItem: (item) => {
    const sanitizedRequest = sanitizeRequestForHistory(item.request);
    const newEntry: HistoryItem = {
      ...item,
      request: sanitizedRequest,
      id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    };

    set((state) => {
      const updated = [newEntry, ...state.history].slice(0, state.retentionLimit);
      persistHistory(updated);
      return { history: updated };
    });
  },

  deleteHistoryItem: (id) => {
    set((state) => {
      const updated = state.history.filter((h) => h.id !== id);
      persistHistory(updated);
      return { history: updated };
    });
  },

  clearHistory: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ history: [] });
  },

  setRetentionLimit: (limit) => set({ retentionLimit: Math.max(10, Math.min(200, limit)) }),
}));
