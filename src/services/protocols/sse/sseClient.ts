import { SseConfig, SseEventEntry } from '../../../types';
import { ISseTransport, SseTransportCallbacks } from '../contracts';
import { substituteVariables } from '../http/diagnosticsAnalyzer';
import { SseStreamParser } from './sseParser';

interface ActiveSseSession {
  mode: 'eventsource' | 'fetch';
  eventSource?: EventSource;
  abortController?: AbortController;
  reconnectTimerId?: ReturnType<typeof setTimeout>;
  manualClose: boolean;
  reconnectAttempt: number;
  lastEventId?: string;
  serverRetryMs?: number;
  callbacks: SseTransportCallbacks;
}

export class BrowserSseClient implements ISseTransport {
  private sessions = new Map<string, ActiveSseSession>();

  public connect(
    sessionId: string,
    config: SseConfig,
    resolvedVariables: Record<string, string>,
    callbacks: SseTransportCallbacks
  ): void {
    this.disconnect(sessionId);

    const resolvedUrl = substituteVariables(config.url || '', resolvedVariables).trim();
    if (!resolvedUrl) {
      callbacks.onStatusChange?.('error', 0);
      callbacks.onError?.('SSE endpoint URL is required.', true);
      return;
    }

    try {
      const parsed = new URL(resolvedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        callbacks.onStatusChange?.('error', 0);
        callbacks.onError?.('SSE endpoint URL must use http:// or https:// protocol.', true);
        return;
      }
    } catch {
      callbacks.onStatusChange?.('error', 0);
      callbacks.onError?.(`Invalid SSE URL: "${resolvedUrl}"`, true);
      return;
    }

    const hasCustomHeaders = (config.headers || []).some((h) => h.enabled && h.key.trim() !== '');
    const hasAuth = config.auth && config.auth.type !== 'none' && config.auth.type !== 'inherit';

    const selectedMode: 'eventsource' | 'fetch' =
      config.connectionMode === 'eventsource'
        ? 'eventsource'
        : config.connectionMode === 'fetch'
        ? 'fetch'
        : hasCustomHeaders || hasAuth
        ? 'fetch'
        : 'eventsource';

    if (selectedMode === 'eventsource' && typeof EventSource !== 'undefined') {
      this.connectEventSource(sessionId, resolvedUrl, config, callbacks);
    } else {
      this.connectFetchStream(sessionId, resolvedUrl, config, resolvedVariables, callbacks, 0);
    }
  }

  private connectEventSource(
    sessionId: string,
    resolvedUrl: string,
    config: SseConfig,
    callbacks: SseTransportCallbacks
  ): void {
    callbacks.onStatusChange?.('connecting', 0);

    let es: EventSource;
    try {
      es = new EventSource(resolvedUrl, { withCredentials: !!config.withCredentials });
    } catch (err) {
      callbacks.onStatusChange?.('error', 0);
      callbacks.onError?.(err instanceof Error ? err.message : 'Failed to create EventSource', true);
      return;
    }

    const session: ActiveSseSession = {
      mode: 'eventsource',
      eventSource: es,
      manualClose: false,
      reconnectAttempt: 0,
      callbacks,
    };
    this.sessions.set(sessionId, session);

    es.onopen = () => {
      callbacks.onStatusChange?.('connected', 0);
      callbacks.onOpen?.('eventsource', 'browser-managed');
    };

    es.onmessage = (msg: MessageEvent) => {
      const dataStr = typeof msg.data === 'string' ? msg.data : String(msg.data ?? '');
      let parsedJson: unknown = undefined;
      if (dataStr.trim().startsWith('{') || dataStr.trim().startsWith('[')) {
        try {
          parsedJson = JSON.parse(dataStr);
        } catch {
          // ignore
        }
      }
      const entry: SseEventEntry = {
        id: 'sse-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        timestamp: Date.now(),
        eventName: msg.type || 'message',
        eventId: msg.lastEventId || undefined,
        data: dataStr,
        parsedJson,
        rawSizeBytes: new TextEncoder().encode(dataStr).byteLength,
      };
      if (entry.eventId) session.lastEventId = entry.eventId;
      callbacks.onEvent?.(entry);
    };

    es.onerror = () => {
      if (session.manualClose) return;
      if (es.readyState === EventSource.CONNECTING) {
        callbacks.onStatusChange?.('reconnecting', ++session.reconnectAttempt);
        callbacks.onError?.('EventSource connection interrupted; browser is attempting automatic reconnect.');
      } else {
        callbacks.onStatusChange?.('error', session.reconnectAttempt);
        callbacks.onError?.('EventSource stream closed with error.', true);
      }
    };
  }

  private async connectFetchStream(
    sessionId: string,
    resolvedUrl: string,
    config: SseConfig,
    resolvedVariables: Record<string, string>,
    callbacks: SseTransportCallbacks,
    attempt: number,
    lastEventId?: string
  ): Promise<void> {
    const abortController = new AbortController();
    const session: ActiveSseSession = {
      mode: 'fetch',
      abortController,
      manualClose: false,
      reconnectAttempt: attempt,
      lastEventId,
      callbacks,
    };
    this.sessions.set(sessionId, session);

    callbacks.onStatusChange?.(attempt > 0 ? 'reconnecting' : 'connecting', attempt);

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };

    for (const h of config.headers || []) {
      if (h.enabled && h.key.trim()) {
        headers[h.key.trim()] = substituteVariables(h.value, resolvedVariables);
      }
    }

    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId;
    }

    // Apply Auth
    if (config.auth) {
      if (config.auth.type === 'bearer' && config.auth.bearer?.token) {
        const token = substituteVariables(config.auth.bearer.token, resolvedVariables);
        headers['Authorization'] = `${config.auth.bearer.prefix || 'Bearer'} ${token}`;
      } else if (config.auth.type === 'basic' && config.auth.basic?.username) {
        const user = substituteVariables(config.auth.basic.username, resolvedVariables);
        const pass = substituteVariables(config.auth.basic.password || '', resolvedVariables);
        headers['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`;
      } else if (config.auth.type === 'apikey') {
        const cfg = config.auth.apikey || config.auth.apiKey;
        if (cfg && cfg.enabled !== false && cfg.key && (cfg.addTo || 'header') === 'header') {
          headers[cfg.key] = substituteVariables(cfg.value || '', resolvedVariables);
        }
      }
    }

    const parser = new SseStreamParser();

    try {
      const response = await fetch(resolvedUrl, {
        method: 'GET',
        headers,
        credentials: config.withCredentials ? 'include' : 'same-origin',
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText || 'Error'} from SSE endpoint`);
      }

      if (!response.body) {
        throw new Error('Response stream body is not readable in this browser environment.');
      }

      session.reconnectAttempt = 0;
      callbacks.onStatusChange?.('connected', 0);
      callbacks.onOpen?.('fetch', 'application-managed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (session.manualClose) break;

        const chunkText = decoder.decode(value, { stream: true });
        const dispatched = parser.feed(chunkText);
        for (const evt of dispatched) {
          if (evt.eventId) session.lastEventId = evt.eventId;
          if (evt.retryMs !== undefined) session.serverRetryMs = evt.retryMs;
          callbacks.onEvent?.(evt);
        }
      }

      // Decode any trailing bytes and flush buffered block
      const trailing = decoder.decode();
      if (trailing) {
        for (const evt of parser.feed(trailing)) {
          callbacks.onEvent?.(evt);
        }
      }
      for (const evt of parser.flush()) {
        callbacks.onEvent?.(evt);
      }

      if (session.manualClose) {
        callbacks.onStatusChange?.('closed', session.reconnectAttempt);
        this.sessions.delete(sessionId);
        return;
      }

      this.scheduleFetchReconnect(sessionId, session, resolvedUrl, config, resolvedVariables, callbacks);
    } catch (err) {
      if (session.manualClose || (err instanceof Error && err.name === 'AbortError')) {
        callbacks.onStatusChange?.('closed', session.reconnectAttempt);
        this.sessions.delete(sessionId);
        return;
      }

      callbacks.onError?.(err instanceof Error ? err.message : 'SSE Fetch stream error');
      this.scheduleFetchReconnect(sessionId, session, resolvedUrl, config, resolvedVariables, callbacks);
    }
  }

  private scheduleFetchReconnect(
    sessionId: string,
    session: ActiveSseSession,
    resolvedUrl: string,
    config: SseConfig,
    resolvedVariables: Record<string, string>,
    callbacks: SseTransportCallbacks
  ): void {
    const maxAttempts = config.maxReconnectAttempts ?? 3;
    if (config.autoReconnect && session.reconnectAttempt < maxAttempts) {
      const nextAttempt = session.reconnectAttempt + 1;
      const delayMs = Math.max(300, session.serverRetryMs ?? config.reconnectDelayMs ?? 3000);
      callbacks.onStatusChange?.('reconnecting', nextAttempt);
      session.reconnectTimerId = setTimeout(() => {
        if (this.sessions.get(sessionId) === session && !session.manualClose) {
          this.connectFetchStream(
            sessionId,
            resolvedUrl,
            config,
            resolvedVariables,
            callbacks,
            nextAttempt,
            session.lastEventId
          );
        }
      }, delayMs);
    } else {
      callbacks.onStatusChange?.('closed', session.reconnectAttempt);
      this.sessions.delete(sessionId);
    }
  }

  public disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.manualClose = true;
    if (session.reconnectTimerId) clearTimeout(session.reconnectTimerId);

    if (session.eventSource) {
      try {
        session.eventSource.close();
      } catch {
        // ignore
      }
    }

    if (session.abortController) {
      try {
        session.abortController.abort(new DOMException('SSE connection closed by user', 'AbortError'));
      } catch {
        // ignore
      }
    }

    this.sessions.delete(sessionId);
    session.callbacks.onStatusChange?.('closed', session.reconnectAttempt);
  }

  public isConnected(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.mode === 'eventsource') {
      return session.eventSource?.readyState === EventSource.OPEN;
    }
    return !session.manualClose && !session.abortController?.signal.aborted;
  }
}

export const sseClient = new BrowserSseClient();
