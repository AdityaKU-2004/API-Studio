import { WebSocketConfig } from '../../../types';
import { IWebSocketTransport, WebSocketTransportCallbacks } from '../contracts';
import { substituteVariables } from '../http/diagnosticsAnalyzer';

interface ActiveSocketEntry {
  socket: WebSocket;
  config: WebSocketConfig;
  resolvedVariables: Record<string, string>;
  callbacks: WebSocketTransportCallbacks;
  connectTimeoutId?: ReturnType<typeof setTimeout>;
  reconnectTimerId?: ReturnType<typeof setTimeout>;
  heartbeatTimerId?: ReturnType<typeof setInterval>;
  reconnectAttempt: number;
  manualClose: boolean;
  resolvedUrl: string;
}

export function validateWebSocketUrl(rawUrl: string): { valid: boolean; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: false, error: 'WebSocket URL is required.' };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return { valid: false, error: 'WebSocket URL must use ws:// or wss:// protocol.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: `Invalid WebSocket URL: "${trimmed}"` };
  }
}

export class BrowserWebSocketClient implements IWebSocketTransport {
  private sessions = new Map<string, ActiveSocketEntry>();

  public connect(
    sessionId: string,
    config: WebSocketConfig,
    resolvedVariables: Record<string, string>,
    callbacks: WebSocketTransportCallbacks
  ): void {
    // Clean up any existing session for this tab
    this.disconnect(sessionId, 'Reinitializing connection');

    const resolvedUrl = substituteVariables(config.url || '', resolvedVariables).trim();
    const validation = validateWebSocketUrl(resolvedUrl);
    if (!validation.valid) {
      callbacks.onStatusChange?.('error', 0);
      callbacks.onError?.(validation.error || 'Invalid WebSocket URL');
      return;
    }

    this.openSocket(sessionId, resolvedUrl, config, resolvedVariables, callbacks, 0);
  }

  private openSocket(
    sessionId: string,
    resolvedUrl: string,
    config: WebSocketConfig,
    resolvedVariables: Record<string, string>,
    callbacks: WebSocketTransportCallbacks,
    attempt: number
  ): void {
    if (typeof WebSocket === 'undefined') {
      callbacks.onStatusChange?.('error', attempt);
      callbacks.onError?.('WebSocket API is not available in this runtime.');
      return;
    }

    callbacks.onStatusChange?.(attempt > 0 ? 'reconnecting' : 'connecting', attempt);

    let socket: WebSocket;
    try {
      const subprotocols = (config.protocols || []).map((p) => p.trim()).filter(Boolean);
      socket = subprotocols.length > 0 ? new WebSocket(resolvedUrl, subprotocols) : new WebSocket(resolvedUrl);
      socket.binaryType = 'arraybuffer';
    } catch (err) {
      callbacks.onStatusChange?.('error', attempt);
      callbacks.onError?.(err instanceof Error ? err.message : 'Failed to construct WebSocket');
      return;
    }

    const entry: ActiveSocketEntry = {
      socket,
      config,
      resolvedVariables,
      callbacks,
      reconnectAttempt: attempt,
      manualClose: false,
      resolvedUrl,
    };

    const timeoutMs = config.connectionTimeoutMs > 0 ? config.connectionTimeoutMs : 10000;
    entry.connectTimeoutId = setTimeout(() => {
      if (socket.readyState === WebSocket.CONNECTING) {
        entry.manualClose = true;
        try {
          socket.close();
        } catch {
          // ignore
        }
        callbacks.onStatusChange?.('error', attempt);
        callbacks.onError?.(`WebSocket connection timed out after ${timeoutMs}ms`);
        this.sessions.delete(sessionId);
      }
    }, timeoutMs);

    this.sessions.set(sessionId, entry);

    socket.onopen = () => {
      if (entry.connectTimeoutId) clearTimeout(entry.connectTimeoutId);
      entry.reconnectAttempt = 0;
      callbacks.onStatusChange?.('connected', 0);
      callbacks.onOpen?.(resolvedUrl);

      // Start optional application-level heartbeat (Note: browser JS cannot send RFC 6455 Ping frames)
      if (config.heartbeatEnabled && config.heartbeatIntervalMs >= 1000 && config.heartbeatMessage) {
        entry.heartbeatTimerId = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            const payload = substituteVariables(config.heartbeatMessage, resolvedVariables);
            this.send(sessionId, payload);
          }
        }, config.heartbeatIntervalMs);
      }
    };

    socket.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(event.data);
        const hexPreview = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        callbacks.onMessage?.(hexPreview, true, bytes.byteLength);
      } else {
        const text = typeof event.data === 'string' ? event.data : String(event.data);
        const sizeBytes = new TextEncoder().encode(text).byteLength;
        callbacks.onMessage?.(text, false, sizeBytes);
      }
    };

    socket.onerror = () => {
      callbacks.onError?.(
        'WebSocket encountered a connection or transport error (browser security hides low-level TLS/handshake failure details).'
      );
    };

    socket.onclose = (event: CloseEvent) => {
      if (entry.connectTimeoutId) clearTimeout(entry.connectTimeoutId);
      if (entry.heartbeatTimerId) clearInterval(entry.heartbeatTimerId);

      callbacks.onClose?.(event.code, event.reason || '', event.wasClean);

      if (entry.manualClose) {
        callbacks.onStatusChange?.('closed', entry.reconnectAttempt);
        this.sessions.delete(sessionId);
        return;
      }

      const maxAttempts = config.maxReconnectAttempts ?? 3;
      if (config.autoReconnect && entry.reconnectAttempt < maxAttempts) {
        const nextAttempt = entry.reconnectAttempt + 1;
        const delayMs = Math.max(250, config.reconnectDelayMs || 2000);
        callbacks.onStatusChange?.('reconnecting', nextAttempt);
        entry.reconnectTimerId = setTimeout(() => {
          if (this.sessions.get(sessionId) === entry && !entry.manualClose) {
            this.openSocket(sessionId, resolvedUrl, config, resolvedVariables, callbacks, nextAttempt);
          }
        }, delayMs);
      } else {
        callbacks.onStatusChange?.(event.wasClean ? 'closed' : 'error', entry.reconnectAttempt);
        this.sessions.delete(sessionId);
      }
    };
  }

  public send(sessionId: string, data: string | ArrayBuffer | Uint8Array): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry || entry.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      entry.socket.send(
        data instanceof Uint8Array ? (data as Uint8Array<ArrayBuffer>) : data
      );
      return true;
    } catch (err) {
      entry.callbacks.onError?.(err instanceof Error ? err.message : 'Failed to send WebSocket message');
      return false;
    }
  }

  public disconnect(sessionId: string, reason = 'Closed by user'): void {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;

    entry.manualClose = true;
    if (entry.connectTimeoutId) clearTimeout(entry.connectTimeoutId);
    if (entry.reconnectTimerId) clearTimeout(entry.reconnectTimerId);
    if (entry.heartbeatTimerId) clearInterval(entry.heartbeatTimerId);

    try {
      if (
        entry.socket.readyState === WebSocket.OPEN ||
        entry.socket.readyState === WebSocket.CONNECTING
      ) {
        entry.socket.close(1000, reason.slice(0, 120));
      }
    } catch {
      // ignore close errors
    }

    this.sessions.delete(sessionId);
    entry.callbacks.onStatusChange?.('closed', entry.reconnectAttempt);
  }

  public isConnected(sessionId: string): boolean {
    const entry = this.sessions.get(sessionId);
    return !!entry && entry.socket.readyState === WebSocket.OPEN;
  }
}

export const websocketClient = new BrowserWebSocketClient();
