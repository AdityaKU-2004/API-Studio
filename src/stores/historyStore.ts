import { create } from 'zustand';
import { HistoryItem } from '../types';
import { initialHistory } from '../data/mockData';

interface HistoryState {
  history: HistoryItem[];
  addHistoryItem: (item: Omit<HistoryItem, 'id'>) => void;
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  history: initialHistory,

  addHistoryItem: (item) =>
    set((state) => ({
      history: [
        {
          ...item,
          id: 'hist-' + Date.now(),
        },
        ...state.history,
      ],
    })),

  deleteHistoryItem: (id) =>
    set((state) => ({
      history: state.history.filter((h) => h.id !== id),
    })),

  clearHistory: () => set({ history: [] }),
}));
