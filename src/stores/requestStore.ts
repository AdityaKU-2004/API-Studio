import { create } from 'zustand';
import { ApiRequest, ApiResponse, HttpMethod, RequestTab } from '../types';
import { sampleRequests } from '../data/mockData';
import { requestService } from '../services/mock/mockRequestService';
import { useEnvironmentStore } from './environmentStore';
import { useHistoryStore } from './historyStore';

export const createDefaultRequest = (name = 'New Request', method: HttpMethod = 'GET'): ApiRequest => ({
  id: 'req-' + Date.now() + Math.random().toString(36).substring(2, 6),
  name,
  method,
  url: '{{base_url}}/users',
  params: [
    { id: 'p-1', key: '', value: '', description: '', enabled: true }
  ],
  headers: [
    { id: 'h-1', key: 'Accept', value: 'application/json', description: '', enabled: true },
    { id: 'h-2', key: 'Content-Type', value: 'application/json', description: '', enabled: true },
  ],
  auth: { type: 'none' },
  bodyType: 'none',
  rawBody: '{\n  "name": "Acme User",\n  "status": "active"\n}',
  formData: [],
  urlEncoded: [],
  preRequestScript: '// Pre-request script\n// pm.environment.set("current_time", Date.now());',
  testScript: 'pm.test("Status is 200", function () {\n  pm.response.to.have.status(200);\n});',
  settings: {
    timeout: 10000,
    followRedirects: true,
    sslVerification: true,
    autoEncodeUrl: true,
  },
});

const initialTabRequest = sampleRequests['req-user-create'];
const initialTab: RequestTab = {
  id: 'tab-initial-1',
  requestId: initialTabRequest.id,
  title: initialTabRequest.name,
  method: initialTabRequest.method,
  isDirty: false,
  request: JSON.parse(JSON.stringify(initialTabRequest)),
};

interface RequestState {
  tabs: RequestTab[];
  activeTabId: string;
  isSending: boolean;
  activeResponse: ApiResponse | null;

  addTab: (customRequest?: Partial<ApiRequest>) => string;
  openRequestInTab: (request: ApiRequest) => string;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  updateActiveRequest: (updates: Partial<ApiRequest>) => void;
  saveActiveRequest: () => void;
  sendRequest: () => Promise<void>;
  setResponse: (response: ApiResponse | null) => void;
}

export const useRequestStore = create<RequestState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  isSending: false,
  activeResponse: null,

  addTab: (customRequest) => {
    const newReq = { ...createDefaultRequest(), ...customRequest };
    const tabId = 'tab-' + Date.now();
    const newTab: RequestTab = {
      id: tabId,
      requestId: newReq.id,
      title: newReq.name,
      method: newReq.method,
      isDirty: false,
      request: newReq,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
      activeResponse: null,
    }));

    return tabId;
  },

  openRequestInTab: (request) => {
    const state = get();
    // Check if already open
    const existing = state.tabs.find((t) => t.requestId === request.id);
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }

    const tabId = 'tab-' + Date.now();
    const newTab: RequestTab = {
      id: tabId,
      requestId: request.id,
      title: request.name,
      method: request.method,
      isDirty: false,
      request: JSON.parse(JSON.stringify(request)),
    };

    set((s) => ({
      tabs: [...s.tabs, newTab],
      activeTabId: tabId,
      activeResponse: null,
    }));

    return tabId;
  },

  closeTab: (tabId) => {
    set((state) => {
      const remaining = state.tabs.filter((t) => t.id !== tabId);
      if (remaining.length === 0) {
        // Always keep at least one tab open
        const fallbackReq = createDefaultRequest('New Request');
        const fallbackTabId = 'tab-' + Date.now();
        const fallbackTab: RequestTab = {
          id: fallbackTabId,
          requestId: fallbackReq.id,
          title: fallbackReq.name,
          method: fallbackReq.method,
          isDirty: false,
          request: fallbackReq,
        };
        return {
          tabs: [fallbackTab],
          activeTabId: fallbackTabId,
          activeResponse: null,
        };
      }

      let nextActiveId = state.activeTabId;
      if (state.activeTabId === tabId) {
        const closedIdx = state.tabs.findIndex((t) => t.id === tabId);
        const nextIdx = Math.max(0, closedIdx - 1);
        nextActiveId = remaining[nextIdx].id;
      }

      return {
        tabs: remaining,
        activeTabId: nextActiveId,
      };
    });
  },

  setActiveTabId: (tabId) => {
    set({ activeTabId: tabId, activeResponse: null });
  },

  updateActiveRequest: (updates) => {
    set((state) => {
      const activeIdx = state.tabs.findIndex((t) => t.id === state.activeTabId);
      if (activeIdx === -1) return state;

      const currentTab = state.tabs[activeIdx];
      const updatedRequest: ApiRequest = {
        ...currentTab.request,
        ...updates,
      };

      const updatedTab: RequestTab = {
        ...currentTab,
        title: updates.name ?? currentTab.title,
        method: updates.method ?? currentTab.method,
        isDirty: true,
        request: updatedRequest,
      };

      const newTabs = [...state.tabs];
      newTabs[activeIdx] = updatedTab;

      return { tabs: newTabs };
    });
  },

  saveActiveRequest: () => {
    set((state) => {
      const activeIdx = state.tabs.findIndex((t) => t.id === state.activeTabId);
      if (activeIdx === -1) return state;

      const newTabs = [...state.tabs];
      newTabs[activeIdx] = {
        ...newTabs[activeIdx],
        isDirty: false,
      };
      return { tabs: newTabs };
    });
  },

  sendRequest: async () => {
    const state = get();
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab || state.isSending) return;

    set({ isSending: true });

    try {
      const resolvedVars = useEnvironmentStore.getState().getResolvedVariables();
      const response = await requestService.executeRequest(activeTab.request, resolvedVars);

      set({ activeResponse: response, isSending: false });

      // Add to history
      useHistoryStore.getState().addHistoryItem({
        method: activeTab.request.method,
        url: activeTab.request.url,
        status: response.status,
        statusText: response.statusText,
        timeMs: response.timeMs,
        timestamp: response.timestamp,
        request: JSON.parse(JSON.stringify(activeTab.request)),
      });
    } catch {
      set({ isSending: false });
    }
  },

  setResponse: (response) => set({ activeResponse: response }),
}));
