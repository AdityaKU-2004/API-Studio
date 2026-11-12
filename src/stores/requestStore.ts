import { create } from 'zustand';
import { ApiRequest, ApiResponse, HttpMethod, RequestTab } from '../types';
import { sampleRequests } from '../data/mockData';
import { httpClient } from '../services/http/httpClient';
import { useExecutionStore } from './executionStore';
import { useEnvironmentStore } from './environmentStore';
import { useHistoryStore } from './historyStore';
import { useCollectionStore } from './collectionStore';
import { buildUrlWithParams, parseUrl } from '../services/request/urlBuilder';

export const createDefaultRequest = (name = 'New Request', method: HttpMethod = 'GET'): ApiRequest => {
  const now = Date.now();
  const id = 'req-' + now + Math.random().toString(36).substring(2, 6);
  const defaultRawBody = '{\n  "name": "Acme User",\n  "status": "active"\n}';

  return {
    id,
    name,
    method,
    url: '{{base_url}}/users',
    params: [
      { id: 'p-1', key: '', value: '', description: '', enabled: true },
    ],
    headers: [
      { id: 'h-1', key: 'Accept', value: 'application/json', description: '', enabled: true },
      { id: 'h-2', key: 'Content-Type', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'none' },
    bodyType: 'none',
    rawBody: defaultRawBody,
    formData: [],
    urlEncoded: [],
    body: {
      mode: 'none',
      rawContent: {
        json: defaultRawBody,
        text: '',
        xml: '',
        html: '',
      },
      formData: [],
      urlEncoded: [],
      binary: {},
    },
    scripts: {
      preRequest: { script: '// Pre-request script\n// pm.environment.set("current_time", Date.now());', enabled: true },
      postResponse: { script: 'pm.test("Status is 200", function () {\n  pm.response.to.have.status(200);\n});', enabled: true },
    },
    preRequestScript: '// Pre-request script\n// pm.environment.set("current_time", Date.now());',
    testScript: 'pm.test("Status is 200", function () {\n  pm.response.to.have.status(200);\n});',
    settings: {
      timeout: 10000,
      followRedirects: true,
      maxRedirects: 5,
      autoEncodeUrl: true,
      sslVerification: true,
      allowInsecureCertificates: false,
      httpVersion: 'auto',
      connectionTimeout: 5000,
      keepAlive: true,
      disableCache: false,
      followAuthRedirects: true,
      customUserAgent: 'API Studio/2.0',
    },
    createdAt: now,
    updatedAt: now,
  };
};

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
  pendingCloseTabId: string | null;

  addTab: (customRequest?: Partial<ApiRequest>) => string;
  openRequestInTab: (request: ApiRequest) => string;
  closeTab: (tabId: string, force?: boolean) => boolean;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  duplicateTab: (tabId: string) => string;
  renameTab: (tabId: string, newTitle: string) => void;
  setActiveTabId: (tabId: string) => void;
  updateActiveRequest: (updates: Partial<ApiRequest>, syncUrl?: boolean) => void;
  updateUrlAndSyncParams: (newUrl: string) => void;
  saveActiveRequest: () => void;
  saveRequestAs: (name: string, collectionId: string, folderId?: string) => void;
  sendRequest: (targetTabId?: string) => Promise<void>;
  cancelRequest: (targetTabId?: string) => void;
  setResponse: (response: ApiResponse | null) => void;
  setPendingCloseTabId: (tabId: string | null) => void;
}

export const useRequestStore = create<RequestState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  isSending: false,
  activeResponse: null,
  pendingCloseTabId: null,

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

  closeTab: (tabId, force = false) => {
    const state = get();
    const tabToClose = state.tabs.find((t) => t.id === tabId);

    // If unsaved changes and not forced, ask confirmation
    if (tabToClose && tabToClose.isDirty && !force) {
      set({ pendingCloseTabId: tabId });
      return false; // Not closed yet
    }

    // Cancel active network request for this tab if running
    httpClient.cancel(tabId);

    const remaining = state.tabs.filter((t) => t.id !== tabId);

    if (remaining.length === 0) {
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

      set({
        tabs: [fallbackTab],
        activeTabId: fallbackTabId,
        activeResponse: null,
        pendingCloseTabId: null,
      });
      return true;
    }

    let nextActiveId = state.activeTabId;
    if (state.activeTabId === tabId) {
      const closedIdx = state.tabs.findIndex((t) => t.id === tabId);
      const nextIdx = Math.max(0, closedIdx - 1);
      nextActiveId = remaining[nextIdx].id;
    }

    set({
      tabs: remaining,
      activeTabId: nextActiveId,
      pendingCloseTabId: null,
    });
    return true;
  },

  closeOtherTabs: (tabId) => {
    set((state) => {
      const target = state.tabs.find((t) => t.id === tabId);
      if (!target) return state;
      return {
        tabs: [target],
        activeTabId: tabId,
      };
    });
  },

  closeAllTabs: () => {
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

    set({
      tabs: [fallbackTab],
      activeTabId: fallbackTabId,
      activeResponse: null,
    });
  },

  duplicateTab: (tabId) => {
    const state = get();
    const target = state.tabs.find((t) => t.id === tabId);
    if (!target) return '';

    const newReq: ApiRequest = {
      ...JSON.parse(JSON.stringify(target.request)),
      id: 'req-' + Date.now() + Math.random().toString(36).substring(2, 6),
      name: `${target.title} (Copy)`,
    };

    const newTabId = 'tab-' + Date.now();
    const newTab: RequestTab = {
      id: newTabId,
      requestId: newReq.id,
      title: newReq.name,
      method: newReq.method,
      isDirty: true,
      request: newReq,
    };

    set({
      tabs: [...state.tabs, newTab],
      activeTabId: newTabId,
    });

    return newTabId;
  },

  renameTab: (tabId, newTitle) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              title: newTitle.trim() || t.title,
              isDirty: true,
              request: { ...t.request, name: newTitle.trim() || t.request.name },
            }
          : t
      ),
    }));
  },

  setActiveTabId: (tabId) => {
    const tabResponse = useExecutionStore.getState().getTabResponse(tabId);
    const isTabExecuting = httpClient.isExecuting(tabId);
    set({
      activeTabId: tabId,
      activeResponse: tabResponse,
      isSending: isTabExecuting,
    });
  },

  updateActiveRequest: (updates, syncUrl = false) => {
    set((state) => {
      const activeIdx = state.tabs.findIndex((t) => t.id === state.activeTabId);
      if (activeIdx === -1) return state;

      const currentTab = state.tabs[activeIdx];
      let updatedRequest: ApiRequest = {
        ...currentTab.request,
        ...updates,
        updatedAt: Date.now(),
      };

      // Keep legacy properties in sync with new object properties
      if (updates.bodyType) {
        updatedRequest.body = {
          ...(updatedRequest.body || {
            rawContent: {},
            formData: [],
            urlEncoded: [],
            binary: {},
          }),
          mode: updates.bodyType,
          rawContent: {
            ...(updatedRequest.body?.rawContent || {}),
            [updates.bodyType]: updatedRequest.rawBody || '',
          },
        };
      }
      if (updates.rawBody !== undefined) {
        updatedRequest.body = {
          ...(updatedRequest.body || {
            mode: updatedRequest.bodyType || 'json',
            rawContent: {},
            formData: [],
            urlEncoded: [],
            binary: {},
          }),
          rawContent: {
            ...(updatedRequest.body?.rawContent || {}),
            [updatedRequest.bodyType || 'json']: updates.rawBody,
          },
        };
      }
      if (updates.preRequestScript !== undefined) {
        updatedRequest.scripts = {
          ...(updatedRequest.scripts || {
            postResponse: { script: updatedRequest.testScript || '', enabled: true },
          }),
          preRequest: { script: updates.preRequestScript, enabled: true },
        };
      }
      if (updates.testScript !== undefined) {
        updatedRequest.scripts = {
          ...(updatedRequest.scripts || {
            preRequest: { script: updatedRequest.preRequestScript || '', enabled: true },
          }),
          postResponse: { script: updates.testScript, enabled: true },
        };
      }

      // If params changed, optionally sync back to URL
      if (updates.params && syncUrl) {
        const autoEncode = updatedRequest.settings?.autoEncodeUrl ?? true;
        updatedRequest.url = buildUrlWithParams(updatedRequest.url, updates.params, autoEncode);
      }

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

  updateUrlAndSyncParams: (newUrl) => {
    set((state) => {
      const activeIdx = state.tabs.findIndex((t) => t.id === state.activeTabId);
      if (activeIdx === -1) return state;

      const currentTab = state.tabs[activeIdx];
      const parsed = parseUrl(newUrl, currentTab.request.params);

      const updatedRequest: ApiRequest = {
        ...currentTab.request,
        url: newUrl,
        params: parsed.params,
        updatedAt: Date.now(),
      };

      const updatedTab: RequestTab = {
        ...currentTab,
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

      const currentTab = state.tabs[activeIdx];

      // Update in collectionStore if it has a collectionId
      if (currentTab.request.collectionId) {
        useCollectionStore.getState().addRequestToCollection(
          currentTab.request.collectionId,
          currentTab.request.folderId || null,
          currentTab.request
        );
      }

      const newTabs = [...state.tabs];
      newTabs[activeIdx] = {
        ...newTabs[activeIdx],
        isDirty: false,
      };
      return { tabs: newTabs };
    });
  },

  saveRequestAs: (name, collectionId, folderId) => {
    const state = get();
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab) return;

    const updatedReq: ApiRequest = {
      ...activeTab.request,
      name,
      collectionId,
      folderId,
      updatedAt: Date.now(),
    };

    useCollectionStore.getState().addRequestToCollection(collectionId, folderId || null, updatedReq);

    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId
          ? {
              ...t,
              title: name,
              isDirty: false,
              request: updatedReq,
            }
          : t
      ),
    }));
  },

  sendRequest: async (targetTabId) => {
    const state = get();
    const tabId = targetTabId || state.activeTabId;
    const targetTab = state.tabs.find((t) => t.id === tabId);
    if (!targetTab || httpClient.isExecuting(tabId)) return;

    if (tabId === state.activeTabId) {
      set({ isSending: true });
    }

    const execStore = useExecutionStore.getState();
    execStore.startExecution(tabId, targetTab.request.id);
    execStore.addLog({
      level: 'info',
      tabId,
      requestId: targetTab.request.id,
      method: targetTab.request.method,
      url: targetTab.request.url,
      title: 'Request Started',
      message: `${targetTab.request.method} ${targetTab.request.url}`,
    });

    try {
      const resolvedVars = useEnvironmentStore.getState().getResolvedVariables();
      const response = await httpClient.execute(targetTab.request, {
        tabId,
        resolvedVariables: resolvedVars,
        timeoutMs: targetTab.request.settings?.timeout,
      });

      execStore.finishExecution(tabId, response);

      // Log completion to console
      if (response.error || response.status === 0) {
        execStore.addLog({
          level: response.error?.type === 'abort' ? 'warn' : 'error',
          tabId,
          requestId: targetTab.request.id,
          method: targetTab.request.method,
          url: targetTab.request.url,
          title: response.error?.type === 'abort' ? 'Request Cancelled' : 'Request Failed',
          message: response.error?.message || 'Network error occurred',
          durationMs: response.timeMs,
        });
      } else {
        execStore.addLog({
          level: 'success',
          tabId,
          requestId: targetTab.request.id,
          method: targetTab.request.method,
          url: targetTab.request.url,
          title: 'Response Received',
          message: `${response.status} ${response.statusText} (${response.timeMs}ms, ${response.size} bytes)`,
          durationMs: response.timeMs,
        });
      }

      // Add to history unless manually aborted
      if (response.error?.type !== 'abort') {
        useHistoryStore.getState().addHistoryItem({
          method: targetTab.request.method,
          url: targetTab.request.url,
          status: response.status,
          statusText: response.statusText,
          timeMs: response.timeMs,
          timestamp: response.timestamp,
          request: JSON.parse(JSON.stringify(targetTab.request)),
        });
      }

      // If this is currently the active tab, update activeResponse and isSending
      if (get().activeTabId === tabId) {
        set({ activeResponse: response, isSending: false });
      }
    } catch {
      if (get().activeTabId === tabId) {
        set({ isSending: false });
      }
    }
  },

  cancelRequest: (targetTabId) => {
    const state = get();
    const tabId = targetTabId || state.activeTabId;
    httpClient.cancel(tabId);
    useExecutionStore.getState().cancelExecution(tabId);
    useExecutionStore.getState().addLog({
      level: 'warn',
      tabId,
      title: 'Request Cancelled',
      message: 'User aborted in-flight HTTP request',
    });
    if (state.activeTabId === tabId) {
      set({ isSending: false });
    }
  },

  setResponse: (response) => {
    const activeTabId = get().activeTabId;
    useExecutionStore.getState().setTabResponse(activeTabId, response);
    set({ activeResponse: response });
  },

  setPendingCloseTabId: (tabId) => set({ pendingCloseTabId: tabId }),
}));
