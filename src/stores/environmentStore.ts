import { create } from 'zustand';
import { Environment, EnvironmentVariable } from '../types';
import { initialEnvironments } from '../data/mockData';

interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentId: string | null;

  setActiveEnvironmentId: (id: string | null) => void;
  addEnvironment: (name: string) => string;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  addVariable: (envId: string, variable: Omit<EnvironmentVariable, 'id'>) => void;
  updateVariable: (envId: string, varId: string, updates: Partial<EnvironmentVariable>) => void;
  deleteVariable: (envId: string, varId: string) => void;
  getResolvedVariables: () => Record<string, string>;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: initialEnvironments,
  activeEnvironmentId: 'env-dev',

  setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),

  addEnvironment: (name) => {
    const newId = 'env-' + Date.now();
    const newEnv: Environment = {
      id: newId,
      name: name.trim() || 'New Environment',
      variables: [
        {
          id: 'v-' + Date.now(),
          key: 'base_url',
          initialValue: 'https://api.example.com',
          currentValue: 'https://api.example.com',
          description: 'Base host address',
          enabled: true,
        },
      ],
    };
    set((state) => ({ environments: [...state.environments, newEnv] }));
    return newId;
  },

  updateEnvironment: (id, updates) =>
    set((state) => ({
      environments: state.environments.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  deleteEnvironment: (id) =>
    set((state) => {
      const remaining = state.environments.filter((e) => e.id !== id);
      return {
        environments: remaining,
        activeEnvironmentId:
          state.activeEnvironmentId === id
            ? remaining.length > 0
              ? remaining[0].id
              : null
            : state.activeEnvironmentId,
      };
    }),

  addVariable: (envId, variable) =>
    set((state) => ({
      environments: state.environments.map((e) => {
        if (e.id !== envId) return e;
        const newVar: EnvironmentVariable = {
          ...variable,
          id: 'v-' + Date.now() + Math.random().toString(36).substring(2, 6),
        };
        return {
          ...e,
          variables: [...e.variables, newVar],
        };
      }),
    })),

  updateVariable: (envId, varId, updates) =>
    set((state) => ({
      environments: state.environments.map((e) => {
        if (e.id !== envId) return e;
        return {
          ...e,
          variables: e.variables.map((v) => (v.id === varId ? { ...v, ...updates } : v)),
        };
      }),
    })),

  deleteVariable: (envId, varId) =>
    set((state) => ({
      environments: state.environments.map((e) => {
        if (e.id !== envId) return e;
        return {
          ...e,
          variables: e.variables.filter((v) => v.id !== varId),
        };
      }),
    })),

  getResolvedVariables: () => {
    const { environments, activeEnvironmentId } = get();
    if (!activeEnvironmentId) return {};
    const active = environments.find((e) => e.id === activeEnvironmentId);
    if (!active) return {};

    const vars: Record<string, string> = {};
    active.variables.forEach((v) => {
      if (v.enabled && v.key.trim()) {
        vars[v.key.trim()] = v.currentValue || v.initialValue;
      }
    });
    return vars;
  },
}));
