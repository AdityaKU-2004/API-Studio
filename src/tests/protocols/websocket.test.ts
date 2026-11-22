import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BrowserWebSocketClient,
  validateWebSocketUrl,
} from '../../services/protocols/websocket/websocketClient';
import { WebSocketConfig } from '../../types';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  public readyState = MockWebSocket.CONNECTING;
  public binaryType = 'blob';
  public sentMessages: Array<string | ArrayBuffer | Uint8Array> = [];
  public onopen: ((ev: any) => void) | null = null;
  public onmessage: ((ev: any) => void) | null = null;
  public onerror: ((ev: any) => void) | null = null;
  public onclose: ((ev: any) => void) | null = null;

  constructor(public url: string, public protocols?: string | string[]) {
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer | Uint8Array) {
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code === 1000 });
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  triggerTextMessage(text: string) {
    this.onmessage?.({ data: text });
  }
}

const baseConfig: WebSocketConfig = {
  url: '{{wsUrl}}/socket',
  protocols: ['chat'],
  autoReconnect: false,
  reconnectDelayMs: 500,
  maxReconnectAttempts: 2,
  connectionTimeoutMs: 5000,
  heartbeatEnabled: false,
  heartbeatIntervalMs: 5000,
  heartbeatMessage: 'ping',
  templates: [],
  retainHistory: false,
  historyLimit: 100,
};

describe('Phase 6: WebSocket Client Lifecycle & Validation', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('validates ws:// and wss:// URLs strictly', () => {
    expect(validateWebSocketUrl('wss://echo.websocket.org').valid).toBe(true);
    expect(validateWebSocketUrl('https://echo.websocket.org').valid).toBe(false);
    expect(validateWebSocketUrl('').valid).toBe(false);
  });

  it('transitions states connecting -> connected -> closed and sends/receives messages', () => {
    const client = new BrowserWebSocketClient();
    const statuses: string[] = [];
    const received: string[] = [];

    client.connect('tab-ws-1', baseConfig, { wsUrl: 'wss://ws.example.com' }, {
      onStatusChange: (status) => statuses.push(status),
      onMessage: (payload) => received.push(payload),
    });

    expect(MockWebSocket.instances).toHaveLength(1);
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toBe('wss://ws.example.com/socket');
    expect(socket.protocols).toEqual(['chat']);

    socket.triggerOpen();
    expect(client.isConnected('tab-ws-1')).toBe(true);

    const sent = client.send('tab-ws-1', '{"hello":"world"}');
    expect(sent).toBe(true);
    expect(socket.sentMessages).toEqual(['{"hello":"world"}']);

    socket.triggerTextMessage('{"ack":true}');
    expect(received).toEqual(['{"ack":true}']);

    client.disconnect('tab-ws-1', 'Test complete');
    expect(client.isConnected('tab-ws-1')).toBe(false);
    expect(statuses).toContain('connecting');
    expect(statuses).toContain('connected');
    expect(statuses[statuses.length - 1]).toBe('closed');
  });

  it('handles connection timeouts and auto-reconnect cleanly', () => {
    vi.useFakeTimers();
    const client = new BrowserWebSocketClient();
    const errors: string[] = [];
    const statuses: string[] = [];

    client.connect(
      'tab-ws-timeout',
      { ...baseConfig, url: 'wss://timeout.test', connectionTimeoutMs: 1000, autoReconnect: true },
      {},
      {
        onStatusChange: (s) => statuses.push(s),
        onError: (msg) => errors.push(msg),
      }
    );

    vi.advanceTimersByTime(1050);
    expect(errors.some((e) => e.includes('timed out'))).toBe(true);
    expect(statuses).toContain('error');
  });
});
