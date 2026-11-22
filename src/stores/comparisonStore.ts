import { create } from 'zustand';
import {
  ComparisonResult,
  ComparisonSession,
  ComparisonSource,
  HistoryItem,
} from '../types';
import { compareResponses } from '../features/comparison/comparisonEngine';
import { comparisonRepository } from '../repositories/comparisonRepository';

const DEFAULT_LEFT: ComparisonSource = {
  label: 'Response A',
  sourceType: 'manual',
  status: 200,
  statusText: 'OK',
  timeMs: 120,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-cache',
  },
  body: JSON.stringify(
    {
      version: '1.0',
      user: { id: 101, name: 'Ada Lovelace', role: 'admin' },
      features: ['graphql', 'http'],
    },
    null,
    2
  ),
};

const DEFAULT_RIGHT: ComparisonSource = {
  label: 'Response B',
  sourceType: 'manual',
  status: 200,
  statusText: 'OK',
  timeMs: 95,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'max-age=60',
    'x-request-id': 'req-8492',
  },
  body: JSON.stringify(
    {
      version: '1.1',
      user: { id: 101, name: 'Ada Lovelace', role: 'owner' },
      features: ['graphql', 'http', 'websocket'],
    },
    null,
    2
  ),
};

export function historyItemToComparisonSource(item: HistoryItem, sideLabel: string): ComparisonSource {
  return {
    label: `${item.requestName || item.url} (${sideLabel})`,
    sourceType: 'history',
    historyId: item.id,
    method: item.method,
    url: item.resolvedUrl || item.url,
    status: item.status,
    statusText: item.statusText,
    timeMs: item.timeMs,
    headers: { ...(item.responseHeaders || {}) },
    body: item.responseBody || item.responseBodySnippet || '',
  };
}

interface ComparisonState {
  left: ComparisonSource;
  right: ComparisonSource;
  maskSensitiveHeaders: boolean;
  result: ComparisonResult;
  savedSessions: ComparisonSession[];
  isLoadingSessions: boolean;

  setLeft: (updates: Partial<ComparisonSource>) => void;
  setRight: (updates: Partial<ComparisonSource>) => void;
  loadFromHistory: (side: 'left' | 'right', item: HistoryItem) => void;
  swapSides: () => void;
  setMaskSensitiveHeaders: (mask: boolean) => void;
  loadSavedSessions: () => Promise<void>;
  saveSession: (name: string) => Promise<void>;
  applySavedSession: (session: ComparisonSession) => void;
  deleteSavedSession: (id: string) => Promise<void>;
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  left: DEFAULT_LEFT,
  right: DEFAULT_RIGHT,
  maskSensitiveHeaders: true,
  result: compareResponses(DEFAULT_LEFT, DEFAULT_RIGHT, { maskSensitiveHeaders: true }),
  savedSessions: [],
  isLoadingSessions: false,

  setLeft: (updates) => {
    set((s) => {
      const nextLeft = { ...s.left, ...updates };
      return {
        left: nextLeft,
        result: compareResponses(nextLeft, s.right, { maskSensitiveHeaders: s.maskSensitiveHeaders }),
      };
    });
  },

  setRight: (updates) => {
    set((s) => {
      const nextRight = { ...s.right, ...updates };
      return {
        right: nextRight,
        result: compareResponses(s.left, nextRight, { maskSensitiveHeaders: s.maskSensitiveHeaders }),
      };
    });
  },

  loadFromHistory: (side, item) => {
    const src = historyItemToComparisonSource(item, side === 'left' ? 'A' : 'B');
    if (side === 'left') {
      get().setLeft(src);
    } else {
      get().setRight(src);
    }
  },

  swapSides: () => {
    set((s) => {
      const nextLeft = s.right;
      const nextRight = s.left;
      return {
        left: nextLeft,
        right: nextRight,
        result: compareResponses(nextLeft, nextRight, { maskSensitiveHeaders: s.maskSensitiveHeaders }),
      };
    });
  },

  setMaskSensitiveHeaders: (mask) => {
    set((s) => ({
      maskSensitiveHeaders: mask,
      result: compareResponses(s.left, s.right, { maskSensitiveHeaders: mask }),
    }));
  },

  loadSavedSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const list = await comparisonRepository.getAll();
      set({ savedSessions: list, isLoadingSessions: false });
    } catch {
      set({ isLoadingSessions: false });
    }
  },

  saveSession: async (name) => {
    const { left, right, maskSensitiveHeaders } = get();
    const now = Date.now();
    const session: ComparisonSession = {
      id: 'cmp-' + now + '-' + Math.random().toString(36).substring(2, 6),
      name: name.trim() || `${left.label} vs ${right.label}`,
      left,
      right,
      maskSensitiveHeaders,
      createdAt: now,
      updatedAt: now,
    };
    await comparisonRepository.save(session);
    await get().loadSavedSessions();
  },

  applySavedSession: (session) => {
    set({
      left: session.left,
      right: session.right,
      maskSensitiveHeaders: session.maskSensitiveHeaders,
      result: compareResponses(session.left, session.right, {
        maskSensitiveHeaders: session.maskSensitiveHeaders,
      }),
    });
  },

  deleteSavedSession: async (id) => {
    await comparisonRepository.delete(id);
    await get().loadSavedSessions();
  },
}));
