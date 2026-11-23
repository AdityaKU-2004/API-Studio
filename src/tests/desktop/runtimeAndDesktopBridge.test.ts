import { describe, it, expect, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  detectRuntimeCapabilities,
  isTauriRuntime,
} from '../../services/runtime/capabilities';
import {
  getCertificateInspector,
  getFileService,
  getHttpTransport,
  getSseTransport,
  getWebSocketTransport,
} from '../../services/runtime/transportFactory';
import {
  setTauriTestBridge,
  invokeDesktop,
} from '../../services/desktop/tauriBridge';
import {
  desktopHttpService,
  serializeRequestToNativePayload,
} from '../../services/desktop/httpService';
import { DesktopWebSocketService } from '../../services/desktop/websocketService';
import { DesktopSseService } from '../../services/desktop/sseService';
import { desktopDatabaseService } from '../../services/desktop/databaseService';
import { ApiRequest } from '../../types';
import { createDefaultWebSocketConfig, createDefaultSseConfig } from '../../services/request/protocolRequestFactory';

function makeSampleRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  const now = Date.now();
  return {
    id: 'req-test-1',
    name: 'Desktop Test Request',
    method: 'POST',
    url: '{{base_url}}/items',
    params: [{ id: 'p1', key: 'limit', value: '25', enabled: true }],
    headers: [{ id: 'h1', key: 'X-Trace', value: 'trace-123', enabled: true }],
    auth: { type: 'bearer', bearer: { token: '{{api_token}}', prefix: 'Bearer' } },
    bodyType: 'json',
    rawBody: '{"ok":true}',
    formData: [],
    urlEncoded: [],
    body: {
      mode: 'json',
      rawContent: { json: '{"ok":true}' },
      formData: [],
      urlEncoded: [],
      binary: {},
    },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: '', enabled: true },
    },
    preRequestScript: '',
    testScript: '',
    settings: {
      timeout: 8000,
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
    ...overrides,
  };
}

describe('Phase 7: Desktop Runtime Detection, Transport Factory & Tauri IPC Bridge', () => {
  afterEach(() => {
    setTauriTestBridge(null);
  });

  it('detects browser vs Tauri desktop runtime capabilities accurately', () => {
    const browserCaps = detectRuntimeCapabilities({});
    expect(browserCaps.mode).toBe('browser');
    expect(browserCaps.isDesktop).toBe(false);
    expect(browserCaps.supportsSqliteStorage).toBe(false);
    expect(browserCaps.supportsCertificateInspection).toBe(false);

    const tauriWindow = { __TAURI_INTERNALS__: {} };
    expect(isTauriRuntime(tauriWindow)).toBe(true);
    const desktopCaps = detectRuntimeCapabilities(tauriWindow);
    expect(desktopCaps.mode).toBe('desktop-tauri');
    expect(desktopCaps.isDesktop).toBe(true);
    expect(desktopCaps.corsBypassAvailable).toBe(true);
    expect(desktopCaps.supportsSqliteStorage).toBe(true);
    expect(desktopCaps.supportsNativeKeyring).toBe(true);
    expect(desktopCaps.supportsCertificateInspection).toBe(true);
  });

  it('routes transport factories cleanly between browser fallback and desktop services', () => {
    expect(getCertificateInspector(false).mode).toBe('browser');
    expect(getCertificateInspector(true).mode).toBe('native-tauri');

    expect(getHttpTransport(true)).toBe(desktopHttpService);
    expect(getHttpTransport(false)).not.toBe(desktopHttpService);

    expect(getWebSocketTransport(true)).not.toBe(getWebSocketTransport(false));
    expect(getSseTransport(true)).not.toBe(getSseTransport(false));
    expect(getFileService(true)).not.toBe(getFileService(false));
  });

  it('serializes HTTP requests with default verifySsl=true and resolves variables/auth/params', async () => {
    const req = makeSampleRequest();
    const { payload, validationError } = await serializeRequestToNativePayload(
      req,
      {
        tabId: 'tab-1',
        resolvedVariables: {
          base_url: 'https://api.acme.test',
          api_token: 'secret-token-xyz',
        },
      },
      'exec-abc',
      'tab-1'
    );

    expect(validationError).toBeUndefined();
    expect(payload).toBeDefined();
    expect(payload!.url).toBe('https://api.acme.test/items?limit=25');
    expect(payload!.headers['Authorization']).toBe('Bearer secret-token-xyz');
    expect(payload!.headers['X-Trace']).toBe('trace-123');
    expect(payload!.tls?.verifySsl).toBe(true);
    expect(payload!.bodyMode).toBe('raw');
    expect(payload!.rawBody).toBe('{"ok":true}');
  });

  it('invokes native HTTP IPC, normalizes response timing without fabricating missing metrics', async () => {
    const invokeMock = vi.fn().mockResolvedValue({
      executionId: 'exec-123',
      requestId: 'req-test-1',
      status: 201,
      statusText: 'Created',
      ok: true,
      finalUrl: 'https://api.acme.test/items?limit=25',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookies: [{ name: 'sid', value: 'v1', httpOnly: true, secure: true }],
      bodyText: '{"created":true}',
      bodyBase64: null,
      isBinary: false,
      contentType: 'application/json',
      contentEncoding: null,
      sizeBytes: 16,
      headerSizeBytes: 38,
      timing: {
        startTime: 1000,
        headersReceivedTime: 1050,
        endTime: 1060,
        durationMs: 60,
        prepareMs: 3,
        dnsLookupMs: 4,
        tcpConnectMs: null,
        tlsHandshakeMs: null,
        ttfbMs: 50,
        downloadMs: 7,
        socketReused: false,
        effectiveProxy: 'http://alice:***@proxy.local:8080',
      },
      tlsVerified: true,
      tlsWarning: null,
      receivedAt: '2026-01-01T00:00:00Z',
    });

    setTauriTestBridge({
      invoke: invokeMock,
      listen: async () => () => {},
    });

    const resp = await desktopHttpService.execute(makeSampleRequest(), {
      tabId: 'tab-9',
      resolvedVariables: { base_url: 'https://api.acme.test', api_token: 'tok' },
    });

    expect(invokeMock).toHaveBeenCalledWith(
      'execute_http_request',
      expect.objectContaining({
        request: expect.objectContaining({ method: 'POST' }),
      })
    );
    expect(resp.status).toBe(201);
    expect(resp.runtimeMode).toBe('desktop-tauri');
    expect(resp.timing.dnsLookupMs).toBe(4);
    expect(resp.timing.tcpConnectMs).toBeNull();
    expect(resp.timing.tlsHandshakeMs).toBeNull();
    expect(resp.effectiveProxy).toBe('http://alice:***@proxy.local:8080');
  });

  it('normalizes structured Rust AppError payloads cleanly', async () => {
    setTauriTestBridge({
      invoke: async () => {
        throw {
          code: 'CREDENTIAL_STORE_UNAVAILABLE',
          message: 'Keychain locked',
          details: 'D-Bus secret service not running',
          recoverable: true,
        };
      },
      listen: async () => () => {},
    });

    await expect(invokeDesktop('keyring_status')).rejects.toMatchObject({
      code: 'CREDENTIAL_STORE_UNAVAILABLE',
      message: 'Keychain locked',
      recoverable: true,
    });
  });

  it('manages Tauri event subscriptions and cleans up listeners cleanly for WebSocket & SSE', async () => {
    const unlistenFns: Array<ReturnType<typeof vi.fn>> = [];
    const handlers = new Map<string, (p: any) => void>();

    setTauriTestBridge({
      invoke: async () => undefined as any,
      listen: async (event, handler) => {
        handlers.set(event, handler);
        const fn = vi.fn();
        unlistenFns.push(fn);
        return fn as any;
      },
    });

    const wsService = new DesktopWebSocketService();
    const onMessage = vi.fn();
    wsService.connect('tab-ws', createDefaultWebSocketConfig('wss://echo.test'), {}, { onMessage });

    await new Promise((r) => setTimeout(r, 15));
    handlers.get('websocket://status')?.({
      sessionId: 'tab-ws',
      status: 'connected',
      resolvedUrl: 'wss://echo.test',
    });
    handlers.get('websocket://message')?.({
      sessionId: 'tab-ws',
      payload: 'hello desktop',
      isBinary: false,
      sizeBytes: 13,
      timestamp: Date.now(),
    });
    expect(onMessage).toHaveBeenCalledWith('hello desktop', false, 13);

    wsService.disposeListeners();

    const sseService = new DesktopSseService();
    const onEvent = vi.fn();
    sseService.connect('tab-sse', createDefaultSseConfig('https://stream.test/sse'), {}, { onEvent });

    await new Promise((r) => setTimeout(r, 15));
    handlers.get('sse://event')?.({
      sessionId: 'tab-sse',
      id: 'evt-1',
      timestamp: Date.now(),
      eventName: 'tick',
      eventId: '42',
      data: '{"count":1}',
      rawSizeBytes: 11,
    });
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'tick',
        eventId: '42',
        parsedJson: { count: 1 },
      })
    );

    sseService.disposeListeners();
    expect(unlistenFns.length).toBe(4);
    for (const fn of unlistenFns) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('builds complete IndexedDB -> SQLite migration payloads', async () => {
    const payload = await desktopDatabaseService.buildMigrationPayload('skip');
    expect(payload).toHaveProperty('collections');
    expect(payload).toHaveProperty('folders');
    expect(payload).toHaveProperty('requests');
    expect(payload).toHaveProperty('environments');
    expect(payload).toHaveProperty('protocolConfigs');
    expect(payload.conflictStrategy).toBe('skip');
  });
});
