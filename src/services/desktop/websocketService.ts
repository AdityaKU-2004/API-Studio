import { UnlistenFn } from '@tauri-apps/api/event';
import { WebSocketConfig } from '../../types';
import { IWebSocketTransport, WebSocketTransportCallbacks } from '../protocols/contracts';
import { substituteVariables } from '../protocols/http/diagnosticsAnalyzer';
import { invokeDesktop, listenDesktop, normalizeDesktopError } from './tauriBridge';

interface WsStatusEvent {
  sessionId: string;
  status: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed' | 'disconnected';
  resolvedUrl?: string;
  closeCode?: number;
  closeReason?: string;
  error?: string;
}

interface WsMessageEvent {
  sessionId: string;
  payload: string;
  isBinary: boolean;
  sizeBytes: number;
  timestamp: number;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export class DesktopWebSocketService implements IWebSocketTransport {
  private sessions = new Map<
    string,
    {
      callbacks: WebSocketTransportCallbacks;
      connected: boolean;
      heartbeatTimer?: ReturnType<typeof setInterval>;
    }
  >();
  private unlistenStatus: UnlistenFn | null = null;
  private unlistenMessage: UnlistenFn | null = null;
  private listenersReady = false;

  private async ensureListeners(): Promise<void> {
    if (this.listenersReady) return;
    this.listenersReady = true;

    this.unlistenStatus = await listenDesktop<WsStatusEvent>('websocket://status', (ev) => {
      const session = this.sessions.get(ev.sessionId);
      if (!session) return;

      if (ev.status === 'connected') {
        session.connected = true;
        session.callbacks.onStatusChange?.('connected', 0);
        session.callbacks.onOpen?.(ev.resolvedUrl || '');
      } else if (ev.status === 'closed') {
        session.connected = false;
        if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
        session.callbacks.onClose?.(ev.closeCode ?? 1000, ev.closeReason || '', true);
        session.callbacks.onStatusChange?.('closed', 0);
        this.sessions.delete(ev.sessionId);
      } else if (ev.status === 'error') {
        session.connected = false;
        if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
        session.callbacks.onStatusChange?.('error', 0);
        if (ev.error) session.callbacks.onError?.(ev.error);
      } else {
        session.callbacks.onStatusChange?.(ev.status, 0);
      }
    });

    this.unlistenMessage = await listenDesktop<WsMessageEvent>('websocket://message', (ev) => {
      const session = this.sessions.get(ev.sessionId);
      if (!session) return;
      session.callbacks.onMessage?.(ev.payload, ev.isBinary, ev.sizeBytes);
    });
  }

  public connect(
    sessionId: string,
    config: WebSocketConfig,
    resolvedVariables: Record<string, string>,
    callbacks: WebSocketTransportCallbacks
  ): void {
    this.disconnect(sessionId, 'Reinitializing connection');
    const resolvedUrl = substituteVariables(config.url || '', resolvedVariables).trim();
    const entry = { callbacks, connected: false };
    this.sessions.set(sessionId, entry);

    void (async () => {
      await this.ensureListeners();
      try {
        await invokeDesktop('ws_connect', {
          payload: {
            sessionId,
            url: resolvedUrl,
            protocols: (config.protocols || []).map((p) => p.trim()).filter(Boolean),
            headers: {},
            timeoutMs: config.connectionTimeoutMs || 10000,
            verifySsl: true,
          },
        });
      } catch (err) {
        const dErr = normalizeDesktopError(err);
        callbacks.onStatusChange?.('error', 0);
        callbacks.onError?.(dErr.message);
        this.sessions.delete(sessionId);
      }
    })();
  }

  public send(sessionId: string, data: string | ArrayBuffer | Uint8Array): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry || !entry.connected) return false;

    let text: string | null = null;
    let binaryBase64: string | null = null;

    if (typeof data === 'string') {
      text = data;
    } else if (data instanceof Uint8Array) {
      binaryBase64 = uint8ToBase64(data);
    } else {
      binaryBase64 = uint8ToBase64(new Uint8Array(data));
    }

    void invokeDesktop('ws_send', {
      payload: {
        sessionId,
        text,
        binaryBase64,
      },
    }).catch((err) => {
      entry.callbacks.onError?.(normalizeDesktopError(err).message);
    });
    return true;
  }

  public disconnect(sessionId: string, _reason = 'Closed by user'): void {
    const entry = this.sessions.get(sessionId);
    if (entry?.heartbeatTimer) clearInterval(entry.heartbeatTimer);
    this.sessions.delete(sessionId);
    void invokeDesktop('ws_disconnect', { sessionId }).catch(() => {});
    entry?.callbacks.onStatusChange?.('closed', 0);
  }

  public isConnected(sessionId: string): boolean {
    return Boolean(this.sessions.get(sessionId)?.connected);
  }

  public disposeListeners(): void {
    this.unlistenStatus?.();
    this.unlistenMessage?.();
    this.unlistenStatus = null;
    this.unlistenMessage = null;
    this.listenersReady = false;
  }
}

export const desktopWebSocketService = new DesktopWebSocketService();
