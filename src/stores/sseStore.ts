import { create } from 'zustand';
import {
  ApiRequest,
  SseConnectionStatus,
  SseEventEntry,
  SseSessionState,
} from '../types';
import { getSseTransport } from '../services/runtime/transportFactory';
import { createDefaultSseConfig } from '../services/request/protocolRequestFactory';
import { protocolConfigRepository } from '../repositories/protocolConfigRepository';
import { useEnvironmentStore } from './environmentStore';
import { useCollectionStore } from './collectionStore';
import { useExecutionStore } from './executionStore';
import { useHistoryStore } from './historyStore';

const pausedEventBuffers = new Map<string, SseEventEntry[]>();

const createEmptySseSession = (tabId: string): SseSessionState => ({
  tabId,
  status: 'disconnected',
  reconnectAttempt: 0,
  isPaused: false,
  events: [],
  bufferedCount: 0,
  totalEventCount: 0,
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

interface SseState {
  sessionsByTabId: Record<string, SseSessionState>;

  getSession: (tabId: string) => SseSessionState;
  connect: (tabId: string, request: ApiRequest) => void;
  disconnect: (tabId: string, request?: ApiRequest) => void;
  togglePause: (tabId: string, historyLimit?: number) => void;
  clearEvents: (tabId: string) => void;
}

export const useSseStore = create<SseState>((set, get) => ({
  sessionsByTabId: {},

  getSession: (tabId) => {
    return get().sessionsByTabId[tabId] || createEmptySseSession(tabId);
  },

  connect: (tabId, request) => {
    const cfg = request.sse || createDefaultSseConfig(request.url);
    const resolvedVars = getResolvedVars(request);
    const execStore = useExecutionStore.getState();
    const cap = Math.max(50, Math.min(5000, cfg.historyLimit || 500));

    pausedEventBuffers.delete(tabId);

    set((s) => {
      const prev = s.sessionsByTabId[tabId] || createEmptySseSession(tabId);
      return {
        sessionsByTabId: {
          ...s.sessionsByTabId,
          [tabId]: {
            ...prev,
            status: 'connecting',
            errorMessage: undefined,
            reconnectAttempt: 0,
            isPaused: false,
            bufferedCount: 0,
          },
        },
      };
    });

    getSseTransport().connect(tabId, cfg, resolvedVars, {
      onStatusChange: (status: SseConnectionStatus, reconnectAttempt = 0) => {
        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySseSession(tabId);
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
      onOpen: (transport, reconnectStrategy) => {
        execStore.addLog({
          level: 'success',
          category: 'sse',
          tabId,
          requestId: request.id,
          url: cfg.url,
          title: 'SSE Stream Connected',
          message: `Connected via ${transport === 'eventsource' ? 'EventSource' : 'Fetch ReadableStream'} (${reconnectStrategy})`,
        });
        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySseSession(tabId);
          return {
            sessionsByTabId: {
              ...s.sessionsByTabId,
              [tabId]: {
                ...prev,
                activeTransport: transport,
                reconnectStrategy,
                connectedAt: Date.now(),
                resolvedUrl: cfg.url,
                errorMessage: undefined,
              },
            },
          };
        });
      },
      onEvent: (event: SseEventEntry) => {
        const current = get().sessionsByTabId[tabId];
        if (current?.isPaused) {
          const buf = pausedEventBuffers.get(tabId) || [];
          buf.push(event);
          if (buf.length > cap) buf.shift();
          pausedEventBuffers.set(tabId, buf);
          set((s) => {
            const prev = s.sessionsByTabId[tabId] || createEmptySseSession(tabId);
            return {
              sessionsByTabId: {
                ...s.sessionsByTabId,
                [tabId]: {
                  ...prev,
                  bufferedCount: buf.length,
                  totalEventCount: prev.totalEventCount + 1,
                  lastEventId: event.eventId || prev.lastEventId,
                  serverRetryMs: event.retryMs ?? prev.serverRetryMs,
                },
              },
            };
          });
          return;
        }

        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySseSession(tabId);
          const nextEvents = [...prev.events, event];
          const trimmed =
            nextEvents.length > cap ? nextEvents.slice(nextEvents.length - cap) : nextEvents;
          return {
            sessionsByTabId: {
              ...s.sessionsByTabId,
              [tabId]: {
                ...prev,
                events: trimmed,
                totalEventCount: prev.totalEventCount + 1,
                lastEventId: event.eventId || prev.lastEventId,
                serverRetryMs: event.retryMs ?? prev.serverRetryMs,
              },
            },
          };
        });
      },
      onError: (message, isFatal) => {
        execStore.addLog({
          level: isFatal ? 'error' : 'warn',
          category: 'sse',
          tabId,
          requestId: request.id,
          url: cfg.url,
          title: 'SSE Stream Notice',
          message,
        });
        set((s) => {
          const prev = s.sessionsByTabId[tabId] || createEmptySseSession(tabId);
          return {
            sessionsByTabId: {
              ...s.sessionsByTabId,
              [tabId]: {
                ...prev,
                errorMessage: message,
              },
            },
          };
        });
      },
    });
  },

  disconnect: (tabId, request) => {
    const session = get().sessionsByTabId[tabId];
    getSseTransport().disconnect(tabId);
    pausedEventBuffers.delete(tabId);

    useExecutionStore.getState().addLog({
      level: 'info',
      category: 'sse',
      tabId,
      requestId: request?.id,
      url: session?.resolvedUrl || request?.sse?.url,
      title: 'SSE Stream Disconnected',
      message: 'Stream aborted by user',
    });

    if (request && request.sse?.retainHistory && session) {
      const now = Date.now();
      const durationMs = session.connectedAt ? now - session.connectedAt : 0;
      void protocolConfigRepository.saveSseEventLog({
        id: 'sselog-' + now,
        requestId: request.id,
        sessionId: tabId,
        url: request.sse.url,
        eventCount: session.totalEventCount,
        startedAt: session.connectedAt || now,
        endedAt: now,
        sampleEvents: session.events.slice(-20).map((e) => ({
          timestamp: e.timestamp,
          eventName: e.eventName,
          eventId: e.eventId,
          rawSizeBytes: e.rawSizeBytes,
        })),
        timestamp: now,
      });

      void useHistoryStore.getState().addHistoryItem({
        requestId: request.id,
        requestName: request.name,
        requestType: 'sse',
        method: 'GET',
        url: request.sse.url,
        resolvedUrl: session.resolvedUrl || request.sse.url,
        status: session.errorMessage ? 0 : 200,
        statusText: 'SSE Stream',
        timeMs: durationMs,
        sizeBytes: session.events.reduce((acc, e) => acc + e.rawSizeBytes, 0),
        timestamp: now,
        executionResult: session.errorMessage ? 'error' : 'success',
        errorSummary: session.errorMessage,
        request: JSON.parse(JSON.stringify(request)),
        protocolMetadata: {
          sessionDurationMs: durationMs,
          eventCount: session.totalEventCount,
          capturedEntries: session.events.slice(-50),
        },
      });
    }
  },

  togglePause: (tabId, historyLimit = 500) => {
    const current = get().sessionsByTabId[tabId];
    if (!current) return;

    if (current.isPaused) {
      // Resume and flush buffered events
      const buffered = pausedEventBuffers.get(tabId) || [];
      pausedEventBuffers.delete(tabId);
      const cap = Math.max(50, Math.min(5000, historyLimit));
      set((s) => {
        const prev = s.sessionsByTabId[tabId] || createEmptySseSession(tabId);
        const merged = [...prev.events, ...buffered];
        const trimmed = merged.length > cap ? merged.slice(merged.length - cap) : merged;
        return {
          sessionsByTabId: {
            ...s.sessionsByTabId,
            [tabId]: {
              ...prev,
              isPaused: false,
              bufferedCount: 0,
              events: trimmed,
            },
          },
        };
      });
    } else {
      set((s) => {
        const prev = s.sessionsByTabId[tabId] || createEmptySseSession(tabId);
        return {
          sessionsByTabId: {
            ...s.sessionsByTabId,
            [tabId]: {
              ...prev,
              isPaused: true,
            },
          },
        };
      });
    }
  },

  clearEvents: (tabId) => {
    pausedEventBuffers.delete(tabId);
    set((s) => {
      const prev = s.sessionsByTabId[tabId];
      if (!prev) return s;
      return {
        sessionsByTabId: {
          ...s.sessionsByTabId,
          [tabId]: {
            ...prev,
            events: [],
            bufferedCount: 0,
          },
        },
      };
    });
  },
}));
