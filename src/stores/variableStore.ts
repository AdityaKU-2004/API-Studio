import { create } from 'zustand';
import { EnvironmentVariable } from '../types';
import { variableRepository } from '../repositories/variableRepository';

interface VariableState {
  globalVariables: EnvironmentVariable[];
  isLoading: boolean;
  isGlobalModalOpen: boolean;

  setGlobalModalOpen: (open: boolean) => void;
  loadGlobalVariables: () => Promise<void>;
  loadVariables: () => Promise<void>;
  addGlobalVariable: (variable: Omit<EnvironmentVariable, 'id'>) => Promise<string>;
  addVariable: (key: string, initialValue?: string, currentValue?: string, isSecret?: boolean, description?: string) => Promise<string>;
  updateGlobalVariable: (id: string, updates: Partial<EnvironmentVariable>) => Promise<void>;
  updateVariable: (id: string, updates: Partial<EnvironmentVariable>) => Promise<void>;
  deleteGlobalVariable: (id: string) => Promise<void>;
  deleteVariable: (id: string) => Promise<void>;
  toggleGlobalVariable: (id: string) => Promise<void>;
}

export const useVariableStore = create<VariableState>((set, get) => ({
  globalVariables: [],
  isLoading: false,
  isGlobalModalOpen: false,

  setGlobalModalOpen: (open) => set({ isGlobalModalOpen: open }),

  loadGlobalVariables: async () => {
    set({ isLoading: true });
    try {
      const vars = await variableRepository.getAllGlobal();
      set({ globalVariables: vars, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addGlobalVariable: async (variable) => {
    const id = 'gvar-' + Date.now() + Math.random().toString(36).substring(2, 6);
    const newVar: EnvironmentVariable = {
      ...variable,
      id,
      scope: 'global',
    };
    await variableRepository.createGlobal(newVar);
    set((state) => ({ globalVariables: [...state.globalVariables, newVar] }));
    return id;
  },

  updateGlobalVariable: async (id, updates) => {
    await variableRepository.updateGlobal(id, updates);
    set((state) => ({
      globalVariables: state.globalVariables.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    }));
  },

  deleteGlobalVariable: async (id) => {
    await variableRepository.deleteGlobal(id);
    set((state) => ({
      globalVariables: state.globalVariables.filter((v) => v.id !== id),
    }));
  },

  toggleGlobalVariable: async (id) => {
    const target = get().globalVariables.find((v) => v.id === id);
    if (!target) return;
    const nextEnabled = !target.enabled;
    await variableRepository.updateGlobal(id, { enabled: nextEnabled });
    set((state) => ({
      globalVariables: state.globalVariables.map((v) =>
        v.id === id ? { ...v, enabled: nextEnabled } : v
      ),
    }));
  },
}));
