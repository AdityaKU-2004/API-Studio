import { create } from 'zustand';
import { DeveloperToolId, DeveloperToolPreferences } from '../types';
import {
  DEFAULT_DEVELOPER_TOOL_PREFERENCES,
  developerToolRepository,
} from '../repositories/developerToolRepository';

interface DeveloperToolsState {
  activeTool: DeveloperToolId;
  preferences: DeveloperToolPreferences;
  isLoaded: boolean;

  loadPreferences: () => Promise<void>;
  setActiveTool: (tool: DeveloperToolId) => void;
  updatePreferences: (updates: Partial<DeveloperToolPreferences>) => Promise<void>;
  toggleFavoriteTool: (tool: DeveloperToolId) => Promise<void>;
}

export const useDeveloperToolsStore = create<DeveloperToolsState>((set, get) => ({
  activeTool: DEFAULT_DEVELOPER_TOOL_PREFERENCES.lastActiveTool,
  preferences: DEFAULT_DEVELOPER_TOOL_PREFERENCES,
  isLoaded: false,

  loadPreferences: async () => {
    try {
      const prefs = await developerToolRepository.getPreferences();
      set({
        preferences: prefs,
        activeTool: prefs.lastActiveTool,
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  setActiveTool: (tool) => {
    set({ activeTool: tool });
    void developerToolRepository.savePreferences({ lastActiveTool: tool }).then((saved) => {
      set({ preferences: saved });
    });
  },

  updatePreferences: async (updates) => {
    const saved = await developerToolRepository.savePreferences(updates);
    set({ preferences: saved });
  },

  toggleFavoriteTool: async (tool) => {
    const current = get().preferences.favoriteTools || [];
    const next = current.includes(tool)
      ? current.filter((t) => t !== tool)
      : [...current, tool];
    const saved = await developerToolRepository.savePreferences({ favoriteTools: next });
    set({ preferences: saved });
  },
}));
