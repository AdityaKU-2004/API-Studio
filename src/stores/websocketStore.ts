import { create } from 'zustand';
import {
  ApiRequest,
  WebSocketConfig,
  WebSocketConnectionStatus,
  WebSocketMessageEntry,
  WebSocketMessageFormat,
  WebSocketMessageTemplate,
  WebSocketSessionState,
} from '../types';
import { websocketClient } from '../services/protocols/websocket/websocketClient';
import { createDefaultWebSocketConfig } from '../services/request/protocolRequestFactory';
import { protocolConfigRepository } from '../repositories/protocolConfigRepository';
import { useEnvironmentStore } from './environmentStore';
import { useCollectionStore } from './collectionStore';
import { useExecutionStore } from './executionStore';
import { useHistoryStore } from './historyStore';

const createEmptySession = (tabId: string): WebSocketSessionState => ({
  tabId,
  status: 'disconnected',
  reconnectAttempt: 0,
  messages: [],
  sentCount: 0,
  receivedCount: 0,
});

function getResolvedVars(request: ApiRequest): Record<string, string> {
  const col = request.collectionId
    ? useCollectionStore.getState().collections.find((c) => c.id === request.collectionId)
    : undefined;
  return useEnvironmentStore.getState().getResolvedVariables({
    collectionVariables: col?.variables,
    requestVariables: request.variables,
  });
}

function appendSessionMessage(
  session: WebSocketSessionState,
  entry: WebSocketMessageEntry,
  limit: number
): WebSocketSessionState {
  const cap = Math.max(20, Math.min(2000, limit || 200));
  const nextMessages = [...session.messages, entry];
  const trimmed =
    nextMessages.length > cap ? nextMessages.slice(nextMessages.length - cap) : nextMessages;
  return {
    ...session,
    messages: trimmed,
    sentCount: session.sentCount + (entry.direction === 'sent' ? 1 : 0),
    receivedCount: session.receivedCount + (entry.direction === 'received' ? 1 : 0),
  };
}

interface WebSocketState {
  sessionsByTabId: Record<string, WebSocketSessionState>;
  templates: WebSocketMessageTemplate[];
  isLoadingTemplates: boolean;

  loadTemplates: () => Promise<void>;
  saveTemplate: (name: string, format: WebSocketMessageFormat, payload: string, description?: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  getSession: (tabId: string) => WebSocketSessionState;
  connect: (tabId: string, request: ApiRequest) => void;
  disconnect: (tabId: string, request?: ApiRequest) => void;
  sendMessage: (
    tabId: string,
    payload: string,
    format: WebSocketMessageFormat,
    config?: WebSocketConfig,
    binaryBytes?: Uint8Array
  ) => boolean;
  clearMessages: (tabId: string) => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  sessionsByTabId: {},
  templates: [],
  isLoadingTemplates: false,

  loadTemplates: async () => {
    set({ isLoadingTemplates: true });
    try {
      const list = await protocolConfigRepository.getAllWsTemplates();
      set({ templates: list, isLoadingTemplates: false });
    } catch {
      set({ isLoadingTemplates: false });
    }
  },

  saveTemplate: async (name, format, payload, description) => {
    const now = Date.now();
    const tpl: WebSocketMessageTemplate = {
      id: 'wstpl-' + now + '-' + Math.random().toString(36).substring(2, 6),
      name: name.trim() || 'Untitled Template',
      format,
      payload,
      description,
      createdAt: now,
      updatedAt: now,
    };
    await protocolConfigRepository.saveWsTemplate(tpl);
    await get().loadTemplates();
  },

  deleteTemplate: async (id) => {
    await protocolConfigRepository.deleteWsTemplate(id);
    await get().loadTemplates();
  },

  getSession: (tabId) => {
    return get().sessionsByTabId[tabId] || createEmptySession(tabId);
  },

  connect: (tabId, request) => {
    const cfg = request.websocket || createDefaultWebSocketConfig(request.url);
    const resolvedVars = getResolvedVars(request);
    const execStore = useExecutionStore.getState();
    const historyLimit = cfg.historyLimit || 200;

    set((s) => {
      const prev = s.sessionsByTabId[tabId] || createEmptySession(tabId);
      return {
        sessionsByTabId: {
          ...s.sessionsByTabId,
          [tabId]: {
            ...prev,
            status: 'connecting',
            errorMessage: undefined,
            closeCode: undefined,
            closeReason: undefined,
            reconnectAttempt: 0,
          },
        },
      };
    });

    websocketClient.connect(tabId, cfg, resolvedVars, {
      onStatusChange: (status: WebSocketConnectionStatus, reconnectAttempt = 0) => {
        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySession(tabId);
          return {
            sessionsByTabId: {
              ...s.sessionsByTabId,
              [tabId]: {
                ...prev,
                status,
                reconnectAttempt,
                ...(status === 'closed' || status === 'disconnected'
                  ? { disconnectedAt: Date.now() }
                  : {}),
              },
            },
          };
        });
      },
      onOpen: (resolvedUrl: string) => {
        execStore.addLog({
          level: 'success',
          category: 'websocket',
          tabId,
          requestId: request.id,
          url: resolvedUrl,
          title: 'WebSocket Connected',
          message: `Connected to ${resolvedUrl}`,
        });
        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySession(tabId);
          const sysEntry: WebSocketMessageEntry = {
            id: 'wsmsg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: Date.now(),
            direction: 'system',
            format: 'text',
            payload: `Connected to ${resolvedUrl}`,
            sizeBytes: 0,
          };
          return {
            sessionsByTabId: {
              ...s.sessionsByTabId,
              [tabId]: appendSessionMessage(
                { ...prev, resolvedUrl, connectedAt: Date.now(), errorMessage: undefined },
                sysEntry,
                historyLimit
              ),
            },
          };
        });
      },
      onMessage: (payload: string, isBinary: boolean, sizeBytes: number) => {
        let format: WebSocketMessageFormat = isBinary ? 'binary' : 'text';
        if (!isBinary) {
          const trimmed = payload.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) format = 'json';
          else if (trimmed.startsWith('<')) format = 'xml';
        }
        const entry: WebSocketMessageEntry = {
          id: 'wsmsg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: Date.now(),
          direction: 'received',
          format,
          payload,
          sizeBytes,
          status: 'received',
          isBinary,
        };
        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySession(tabId);
          return {
            sessionsByTabId: {
              ...s.sessionsByTabId,
              [tabId]: appendSessionMessage(prev, entry, historyLimit),
            },
          };
        });
      },
      onError: (message: string) => {
        execStore.addLog({
          level: 'error',
          category: 'websocket',
          tabId,
          requestId: request.id,
          url: cfg.url,
          title: 'WebSocket Error',
          message,
        });
        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySession(tabId);
          const sysEntry: WebSocketMessageEntry = {
            id: 'wsmsg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: Date.now(),
            direction: 'system',
            format: 'text',
            payload: message,
            sizeBytes: 0,
            status: 'error',
          };
          return {
            sessionsByTabId: {
              ...s.sessionsByTabId,
              [tabId]: appendSessionMessage(
                { ...prev, errorMessage: message },
                sysEntry,
                historyLimit
              ),
            },
          };
        });
      },
      onClose: (code: number, reason: string) => {
        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySession(tabId);
          const sysEntry: WebSocketMessageEntry = {
            id: 'wsmsg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: Date.now(),
            direction: 'system',
            format: 'text',
            payload: `Connection closed (code ${code}${reason ? `, reason: ${reason}` : ''})`,
            sizeBytes: 0,
          };
          return {
            sessionsByTabId: {
              ...s.sessionsByTabId,
              [tabId]: appendSessionMessage(
                { ...prev, closeCode: code, closeReason: reason, disconnectedAt: Date.now() },
                sysEntry,
                historyLimit
              ),
            },
          };
        });
      },
    });
  },

  disconnect: (tabId, request) => {
    const session = get().sessionsByTabId[tabId];
    websocketClient.disconnect(tabId, 'Closed by user');

    useExecutionStore.getState().addLog({
      level: 'info',
      category: 'websocket',
      tabId,
      requestId: request?.id,
      url: session?.resolvedUrl || request?.websocket?.url,
      title: 'WebSocket Disconnected',
      message: 'Session closed by user',
    });

    if (request && request.websocket?.retainHistory && session) {
      const durationMs = session.connectedAt ? Date.now() - session.connectedAt : 0;
      void useHistoryStore.getState().addHistoryItem({
        requestId: request.id,
        requestName: request.name,
        requestType: 'websocket',
        method: 'GET',
        url: request.websocket.url,
        resolvedUrl: session.resolvedUrl || request.websocket.url,
        status: session.closeCode || 1000,
        statusText: 'WebSocket Session',
        timeMs: durationMs,
        sizeBytes: session.messages.reduce((acc, m) => acc + m.sizeBytes, 0),
        timestamp: Date.now(),
        executionResult: session.errorMessage ? 'error' : 'success',
        errorSummary: session.errorMessage,
        request: JSON.parse(JSON.stringify(request)),
        protocolMetadata: {
          sessionDurationMs: durationMs,
          messageCount: session.messages.length,
          capturedEntries: session.messages.slice(-50),
        },
      });
    }
  },

  sendMessage: (tabId, payload, format, config, binaryBytes) => {
    const dataToSend = format === 'binary' && binaryBytes ? binaryBytes : payload;
    const sent = websocketClient.send(tabId, dataToSend);
    const sizeBytes =
      format === 'binary' && binaryBytes
        ? binaryBytes.byteLength
        : new TextEncoder().encode(payload).byteLength;

    if (!sent) return false;

    const entry: WebSocketMessageEntry = {
      id: 'wsmsg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      direction: 'sent',
      format,
      payload,
      sizeBytes,
      status: 'sent',
      isBinary: format === 'binary',
    };

    const limit = config?.historyLimit || 200;
    set((s) => {
      const prev = s.sessionsByTabId[tabId] || createEmptySession(tabId);
      return {
        sessionsByTabId: {
          ...s.sessionsByTabId,
          [tabId]: appendSessionMessage(prev, entry, limit),
        },
      };
    });

    return true;
  },

  clearMessages: (tabId) => {
    set((s) => {
      const prev = s.sessionsByTabId[tabId];
      if (!prev) return s;
      return {
        sessionsByTabId: {
          ...s.sessionsByTabId,
          [tabId]: {
            ...prev,
            messages: [],
          },
        },
      };
    });
  },
}));
