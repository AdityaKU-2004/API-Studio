import { create } from 'zustand';
import { AssertionConfiguration, SavedJsonSchema } from '../types';
import { jsonSchemaRepository } from '../repositories/jsonSchemaRepository';
import { assertionRepository } from '../repositories/assertionRepository';

interface TestingState {
  schemas: SavedJsonSchema[];
  assertionConfigs: AssertionConfiguration[];
  isLoading: boolean;

  loadTestingData: () => Promise<void>;
  saveSchema: (schema: Omit<SavedJsonSchema, 'createdAt' | 'updatedAt'> & Partial<Pick<SavedJsonSchema, 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteSchema: (id: string) => Promise<void>;
  getSchemaById: (id: string) => SavedJsonSchema | undefined;

  saveAssertionConfig: (config: Omit<AssertionConfiguration, 'createdAt' | 'updatedAt'> & Partial<Pick<AssertionConfiguration, 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteAssertionConfig: (id: string) => Promise<void>;
}

export const useTestingStore = create<TestingState>((set, get) => ({
  schemas: [],
  assertionConfigs: [],
  isLoading: false,

  loadTestingData: async () => {
    set({ isLoading: true });
    try {
      const [schemas, assertionConfigs] = await Promise.all([
        jsonSchemaRepository.getAll(),
        assertionRepository.getAll(),
      ]);
      set({ schemas, assertionConfigs, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  saveSchema: async (schema) => {
    const now = Date.now();
    await jsonSchemaRepository.save({
      ...schema,
      createdAt: schema.createdAt || now,
      updatedAt: now,
    });
    await get().loadTestingData();
  },

  deleteSchema: async (id) => {
    await jsonSchemaRepository.delete(id);
    await get().loadTestingData();
  },

  getSchemaById: (id) => {
    return get().schemas.find((s) => s.id === id);
  },

  saveAssertionConfig: async (config) => {
    const now = Date.now();
    await assertionRepository.save({
      ...config,
      createdAt: config.createdAt || now,
      updatedAt: now,
    });
    await get().loadTestingData();
  },

  deleteAssertionConfig: async (id) => {
    await assertionRepository.delete(id);
    await get().loadTestingData();
  },
}));
