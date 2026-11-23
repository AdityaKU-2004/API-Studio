import { UnlistenFn } from '@tauri-apps/api/event';
import { SseConfig, SseEventEntry } from '../../types';
import { ISseTransport, SseTransportCallbacks } from '../protocols/contracts';
import { substituteVariables } from '../protocols/http/diagnosticsAnalyzer';
import { invokeDesktop, listenDesktop, normalizeDesktopError } from './tauriBridge';

interface SseStatusEvent {
  sessionId: string;
  status: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed' | 'disconnected';
  attempt: number;
  error?: string;
  fatal: boolean;
}

interface NativeSseEventPayload {
  sessionId: string;
  id: string;
  timestamp: number;
  eventName: string;
  eventId?: string;
  data: string;
  retryMs?: number;
  rawSizeBytes: number;
}

export class DesktopSseService implements ISseTransport {
  private sessions = new Map<
    string,
    { callbacks: SseTransportCallbacks; connected: boolean }
  >();
  private unlistenStatus: UnlistenFn | null = null;
  private unlistenEvent: UnlistenFn | null = null;
  private listenersReady = false;

  private async ensureListeners(): Promise<void> {
    if (this.listenersReady) return;
    this.listenersReady = true;

    this.unlistenStatus = await listenDesktop<SseStatusEvent>('sse://status', (ev) => {
      const session = this.sessions.get(ev.sessionId);
      if (!session) return;
      if (ev.status === 'connected') {
        session.connected = true;
        session.callbacks.onStatusChange?.('connected', 0);
        session.callbacks.onOpen?.('fetch', 'application-managed');
      } else if (ev.status === 'closed') {
        session.connected = false;
        session.callbacks.onStatusChange?.('closed', ev.attempt);
        this.sessions.delete(ev.sessionId);
      } else {
        session.connected = false;
        session.callbacks.onStatusChange?.(ev.status, ev.attempt);
        if (ev.error) {
          session.callbacks.onError?.(ev.error, ev.fatal);
        }
      }
    });

    this.unlistenEvent = await listenDesktop<NativeSseEventPayload>('sse://event', (ev) => {
      const session = this.sessions.get(ev.sessionId);
      if (!session) return;

      let parsedJson: unknown = undefined;
      const trimmed = ev.data.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          parsedJson = JSON.parse(trimmed);
        } catch {
          // leave undefined
        }
      }

      const entry: SseEventEntry = {
        id: ev.id,
        timestamp: ev.timestamp,
        eventName: ev.eventName,
        eventId: ev.eventId,
        data: ev.data,
        retryMs: ev.retryMs,
        parsedJson,
        rawSizeBytes: ev.rawSizeBytes,
      };
      session.callbacks.onEvent?.(entry);
    });
  }

  public connect(
    sessionId: string,
    config: SseConfig,
    resolvedVariables: Record<string, string>,
    callbacks: SseTransportCallbacks
  ): void {
    this.disconnect(sessionId);
    const resolvedUrl = substituteVariables(config.url || '', resolvedVariables).trim();
    const headers: Record<string, string> = {};
    for (const h of config.headers || []) {
      if (h.enabled && h.key.trim()) {
        headers[substituteVariables(h.key.trim(), resolvedVariables)] = substituteVariables(
          h.value,
          resolvedVariables
        );
      }
    }

    if (config.auth) {
      if (config.auth.type === 'bearer' && config.auth.bearer?.token) {
        const tok = substituteVariables(config.auth.bearer.token, resolvedVariables);
        headers['Authorization'] = `${config.auth.bearer.prefix || 'Bearer'} ${tok}`;
      } else if (config.auth.type === 'basic' && config.auth.basic?.username) {
        const u = substituteVariables(config.auth.basic.username, resolvedVariables);
        const p = substituteVariables(config.auth.basic.password || '', resolvedVariables);
        headers['Authorization'] = `Basic ${btoa(`${u}:${p}`)}`;
      } else if (config.auth.type === 'apikey') {
        const cfg = config.auth.apikey || config.auth.apiKey;
        if (cfg && cfg.enabled !== false && cfg.key && (cfg.addTo || 'header') === 'header') {
          headers[cfg.key] = substituteVariables(cfg.value || '', resolvedVariables);
        }
      }
    }

    this.sessions.set(sessionId, { callbacks, connected: false });

    void (async () => {
      await this.ensureListeners();
      try {
        await invokeDesktop('sse_connect', {
          payload: {
            sessionId,
            url: resolvedUrl,
            headers,
            autoReconnect: config.autoReconnect,
            maxReconnectAttempts: config.maxReconnectAttempts ?? 3,
            reconnectDelayMs: config.reconnectDelayMs ?? 3000,
            verifySsl: true,
          },
        });
      } catch (err) {
        const dErr = normalizeDesktopError(err);
        callbacks.onStatusChange?.('error', 0);
        callbacks.onError?.(dErr.message, true);
        this.sessions.delete(sessionId);
      }
    })();
  }

  public disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    void invokeDesktop('sse_disconnect', { sessionId }).catch(() => {});
    session?.callbacks.onStatusChange?.('closed', 0);
  }

  public isConnected(sessionId: string): boolean {
    return Boolean(this.sessions.get(sessionId)?.connected);
  }

  public disposeListeners(): void {
    this.unlistenStatus?.();
    this.unlistenEvent?.();
    this.unlistenStatus = null;
    this.unlistenEvent = null;
    this.listenersReady = false;
  }
}

export const desktopSseService = new DesktopSseService();
