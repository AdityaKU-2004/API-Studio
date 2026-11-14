import { create } from 'zustand';
import { Environment, EnvironmentVariable, ScopedVariableContext } from '../types';
import { initialEnvironments } from '../data/mockData';
import { environmentRepository } from '../repositories/environmentRepository';
import { useVariableStore } from './variableStore';
import { buildEffectiveVariableMap } from '../services/variables/variableResolver';

interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentId: string | null;
  isLoading: boolean;
  revealedSecretKeys: Record<string, boolean>;

  loadEnvironments: () => Promise<void>;
  setActiveEnvironmentId: (id: string | null) => void;
  addEnvironment: (name: string, description?: string) => Promise<string>;
  updateEnvironment: (id: string, updates: Partial<Environment>) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
  duplicateEnvironment: (id: string) => Promise<string | null>;

  addVariable: (envId: string, variable: Omit<EnvironmentVariable, 'id'>) => Promise<void>;
  updateVariable: (envId: string, varId: string, updates: Partial<EnvironmentVariable>) => Promise<void>;
  deleteVariable: (envId: string, varId: string) => Promise<void>;
  toggleSecretReveal: (varId: string) => void;

  getResolvedVariables: (context?: ScopedVariableContext) => Record<string, string>;
  getEffectiveVariableEntries: (context?: ScopedVariableContext) => Record<
    string,
    { value: string; isSecret: boolean; scope: string }
  >;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: initialEnvironments,
  activeEnvironmentId: 'env-dev',
  isLoading: false,
  revealedSecretKeys: {},

  loadEnvironments: async () => {
    set({ isLoading: true });
    try {
      const list = await environmentRepository.getAll();
      if (list.length > 0) {
        set({ environments: list, isLoading: false });
      } else {
        set({ environments: initialEnvironments, isLoading: false });
      }
    } catch {
      set({ environments: initialEnvironments, isLoading: false });
    }
  },

  setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),

  addEnvironment: async (name, description = '') => {
    const newId = 'env-' + Date.now();
    const newEnv: Environment = {
      id: newId,
      name: name.trim() || 'New Environment',
      description,
      variables: [
        {
          id: 'v-' + Date.now(),
          key: 'base_url',
          initialValue: 'https://api.example.com',
          currentValue: 'https://api.example.com',
          description: 'Base host address',
          enabled: true,
          isSecret: false,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await environmentRepository.create(newEnv);
    await get().loadEnvironments();
    return newId;
  },

  updateEnvironment: async (id, updates) => {
    await environmentRepository.update(id, updates);
    await get().loadEnvironments();
  },

  deleteEnvironment: async (id) => {
    await environmentRepository.delete(id);
    const remaining = get().environments.filter((e) => e.id !== id);
    set({
      environments: remaining,
      activeEnvironmentId:
        get().activeEnvironmentId === id
          ? remaining.length > 0
            ? remaining[0].id
            : null
          : get().activeEnvironmentId,
    });
  },

  duplicateEnvironment: async (id) => {
    const dup = await environmentRepository.duplicate(id);
    if (!dup) return null;
    await get().loadEnvironments();
    return dup.id;
  },

  addVariable: async (envId, variable) => {
    const target = get().environments.find((e) => e.id === envId);
    if (!target) return;

    const newVar: EnvironmentVariable = {
      ...variable,
      id: 'v-' + Date.now() + Math.random().toString(36).substring(2, 6),
      scope: 'environment',
    };

    const updatedVars = [...target.variables, newVar];
    await environmentRepository.update(envId, { variables: updatedVars });
    await get().loadEnvironments();
  },

  updateVariable: async (envId, varId, updates) => {
    const target = get().environments.find((e) => e.id === envId);
    if (!target) return;

    const updatedVars = target.variables.map((v) => (v.id === varId ? { ...v, ...updates } : v));
    await environmentRepository.update(envId, { variables: updatedVars });
    await get().loadEnvironments();
  },

  deleteVariable: async (envId, varId) => {
    const target = get().environments.find((e) => e.id === envId);
    if (!target) return;

    const updatedVars = target.variables.filter((v) => v.id !== varId);
    await environmentRepository.update(envId, { variables: updatedVars });
    await get().loadEnvironments();
  },

  toggleSecretReveal: (varId) =>
    set((state) => ({
      revealedSecretKeys: {
        ...state.revealedSecretKeys,
        [varId]: !state.revealedSecretKeys[varId],
      },
    })),

  getEffectiveVariableEntries: (context = {}) => {
    const { environments, activeEnvironmentId } = get();
    const active = environments.find((e) => e.id === activeEnvironmentId);
    const globalVars = useVariableStore.getState().globalVariables;

    return buildEffectiveVariableMap({
      globalVariables: context.globalVariables || globalVars,
      collectionVariables: context.collectionVariables,
      folderVariables: context.folderVariables,
      environmentVariables: context.environmentVariables || active?.variables,
      requestVariables: context.requestVariables,
    });
  },

  getResolvedVariables: (context = {}) => {
    const entries = get().getEffectiveVariableEntries(context);
    const result: Record<string, string> = {};
    for (const [key, info] of Object.entries(entries)) {
      result[key] = info.value;
    }
    return result;
  },
}));
