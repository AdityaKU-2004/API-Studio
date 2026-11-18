import { create } from 'zustand';
import { TestSuite } from '../types';
import { testSuiteRepository } from '../repositories/testSuiteRepository';

interface TestSuiteState {
  suites: TestSuite[];
  activeSuiteId: string | null;
  isLoading: boolean;

  loadSuites: () => Promise<void>;
  setActiveSuiteId: (id: string | null) => void;
  createSuite: (partial?: Partial<TestSuite>) => Promise<string>;
  updateSuite: (id: string, updates: Partial<TestSuite>) => Promise<void>;
  duplicateSuite: (id: string) => Promise<string | null>;
  deleteSuite: (id: string) => Promise<void>;
}

export const useTestSuiteStore = create<TestSuiteState>((set, get) => ({
  suites: [],
  activeSuiteId: null,
  isLoading: false,

  loadSuites: async () => {
    set({ isLoading: true });
    try {
      const suites = await testSuiteRepository.getAll();
      set({
        suites,
        activeSuiteId:
          get().activeSuiteId && suites.some((s) => s.id === get().activeSuiteId)
            ? get().activeSuiteId
            : suites[0]?.id || null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveSuiteId: (id) => set({ activeSuiteId: id }),

  createSuite: async (partial = {}) => {
    const now = Date.now();
    const id = `suite-${now}-${Math.random().toString(36).substring(2, 6)}`;
    const suite: TestSuite = {
      id,
      name: partial.name || 'New Test Suite',
      description: partial.description || 'Automated API regression suite',
      folder: partial.folder || 'General',
      collectionId: partial.collectionId,
      requestIds: partial.requestIds || [],
      environmentId: partial.environmentId ?? null,
      assertions: partial.assertions || [],
      iterations: partial.iterations ?? 1,
      delayMs: partial.delayMs ?? 0,
      failureMode: partial.failureMode || 'continue',
      timeoutMs: partial.timeoutMs ?? 10000,
      iterationData: partial.iterationData || [],
      createdAt: now,
      updatedAt: now,
    };
    await testSuiteRepository.create(suite);
    await get().loadSuites();
    set({ activeSuiteId: id });
    return id;
  },

  updateSuite: async (id, updates) => {
    await testSuiteRepository.update(id, updates);
    await get().loadSuites();
  },

  duplicateSuite: async (id) => {
    const existing = get().suites.find((s) => s.id === id);
    if (!existing) return null;
    const now = Date.now();
    const copyId = `suite-${now}-${Math.random().toString(36).substring(2, 6)}`;
    const copy: TestSuite = {
      ...JSON.parse(JSON.stringify(existing)),
      id: copyId,
      name: `${existing.name} (Copy)`,
      lastRunReportId: undefined,
      lastRunStatus: undefined,
      lastRunAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
    await testSuiteRepository.create(copy);
    await get().loadSuites();
    set({ activeSuiteId: copyId });
    return copyId;
  },

  deleteSuite: async (id) => {
    await testSuiteRepository.delete(id);
    await get().loadSuites();
  },
}));
