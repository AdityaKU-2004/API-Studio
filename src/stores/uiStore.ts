import { create } from 'zustand';

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  lineNumbers: 'on' | 'off';
  minimap: boolean;
}

export interface GeneralSettings {
  defaultTimeout: number;
  startupBehavior: 'last-session' | 'empty' | 'default-template';
  accentColor: 'blue' | 'cyan' | 'emerald' | 'violet';
  defaultMethod: 'GET' | 'POST';
  defaultContentType: 'application/json' | 'text/plain' | 'application/xml';
}

interface UiState {
  theme: 'dark' | 'light';
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  splitRatio: number; // percentage (30 to 75)
  activeRequestTab: 'params' | 'headers' | 'auth' | 'body' | 'scripts' | 'settings';
  activeResponseTab: 'body' | 'headers' | 'cookies' | 'tests';
  responseBodyFormat: 'pretty' | 'raw' | 'preview';
  editorSettings: EditorSettings;
  generalSettings: GeneralSettings;

  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setSplitRatio: (ratio: number) => void;
  setActiveRequestTab: (tab: UiState['activeRequestTab']) => void;
  setActiveResponseTab: (tab: UiState['activeResponseTab']) => void;
  setResponseBodyFormat: (format: UiState['responseBodyFormat']) => void;
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;
}

const getStoredItem = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

const initialTheme = getStoredItem<'dark' | 'light'>('api_studio_theme', 'dark');

// Apply theme to document
if (typeof document !== 'undefined') {
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useUiStore = create<UiState>((set) => ({
  theme: initialTheme,
  sidebarWidth: getStoredItem<number>('api_studio_sidebar_width', 280),
  isSidebarCollapsed: false,
  splitRatio: getStoredItem<number>('api_studio_split_ratio', 52),
  activeRequestTab: 'params',
  activeResponseTab: 'body',
  responseBodyFormat: 'pretty',
  editorSettings: getStoredItem<EditorSettings>('api_studio_editor_settings', {
    fontSize: 13,
    tabSize: 2,
    wordWrap: 'on',
    lineNumbers: 'on',
    minimap: false,
  }),
  generalSettings: getStoredItem<GeneralSettings>('api_studio_general_settings', {
    defaultTimeout: 10000,
    startupBehavior: 'last-session',
    accentColor: 'blue',
    defaultMethod: 'GET',
    defaultContentType: 'application/json',
  }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('api_studio_theme', JSON.stringify(next));
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: next };
    }),

  setTheme: (theme) => {
    localStorage.setItem('api_studio_theme', JSON.stringify(theme));
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },

  setSidebarWidth: (width) => {
    const clamped = Math.max(220, Math.min(480, width));
    localStorage.setItem('api_studio_sidebar_width', JSON.stringify(clamped));
    set({ sidebarWidth: clamped });
  },

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSplitRatio: (ratio) => {
    const clamped = Math.max(25, Math.min(75, ratio));
    localStorage.setItem('api_studio_split_ratio', JSON.stringify(clamped));
    set({ splitRatio: clamped });
  },

  setActiveRequestTab: (tab) => set({ activeRequestTab: tab }),
  setActiveResponseTab: (tab) => set({ activeResponseTab: tab }),
  setResponseBodyFormat: (format) => set({ responseBodyFormat: format }),

  updateEditorSettings: (settings) =>
    set((state) => {
      const updated = { ...state.editorSettings, ...settings };
      localStorage.setItem('api_studio_editor_settings', JSON.stringify(updated));
      return { editorSettings: updated };
    }),

  updateGeneralSettings: (settings) =>
    set((state) => {
      const updated = { ...state.generalSettings, ...settings };
      localStorage.setItem('api_studio_general_settings', JSON.stringify(updated));
      return { generalSettings: updated };
    }),
}));
