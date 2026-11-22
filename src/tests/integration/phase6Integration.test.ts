import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ApiStudioDatabase } from '../../database/database';
import { CollectionExporter } from '../../services/collections/collectionExporter';
import { CollectionImporter } from '../../services/collections/collectionImporter';
import { createDefaultRequest } from '../../stores/requestStore';
import { evaluateJsonPath } from '../../features/response-analysis/jsonPathService';
import {
  analyzeRequestDiagnostics,
  buildRequestPreviewSummary,
} from '../../services/protocols/http/diagnosticsAnalyzer';
import { ProtocolConfigRepository } from '../../repositories/protocolConfigRepository';
import { ComparisonRepository } from '../../repositories/comparisonRepository';
import { DeveloperToolRepository } from '../../repositories/developerToolRepository';

describe('Phase 6: Dexie v3 Persistence, Postman Multi-Protocol Interop, JSONPath & Diagnostics', () => {
  let db: ApiStudioDatabase;
  let exporter: CollectionExporter;
  let importer: CollectionImporter;

  beforeEach(async () => {
    db = new ApiStudioDatabase();
    await db.open();
    await Promise.all([
      db.collections.clear(),
      db.folders.clear(),
      db.requests.clear(),
      db.protocolConfigs.clear(),
      db.comparisonSessions.clear(),
      db.developerToolPreferences.clear(),
    ]);
    exporter = new CollectionExporter(db);
    importer = new CollectionImporter(db);
  });

  it('persists protocol configs, comparison sessions, and developer tool preferences in Dexie v3 tables', async () => {
    const protoRepo = new ProtocolConfigRepository(db);
    const cmpRepo = new ComparisonRepository(db);
    const devRepo = new DeveloperToolRepository(db);

    await protoRepo.saveConfig({
      id: 'cfg-gql-1',
      requestId: 'req-gql-1',
      protocol: 'graphql',
      name: 'Ping Query',
      configJson: JSON.stringify({
        endpoint: 'https://api.test/graphql',
        method: 'POST',
        query: '{ ping }',
        variablesText: '{}',
        queryHistory: [],
      }),
      updatedAt: Date.now(),
    });
    const loadedProto = await protoRepo.getConfigByRequestId('req-gql-1');
    expect(loadedProto?.protocol).toBe('graphql');

    await cmpRepo.save({
      id: 'cmp-1',
      name: 'V1 vs V2',
      left: { label: 'A', sourceType: 'manual', headers: {}, body: '{"v":1}' },
      right: { label: 'B', sourceType: 'manual', headers: {}, body: '{"v":2}' },
      maskSensitiveHeaders: true,
      createdAt: 1,
      updatedAt: 1,
    });
    expect(await cmpRepo.getAll()).toHaveLength(1);

    const savedPrefs = await devRepo.savePreferences({ lastActiveTool: 'jwt-decoder', jsonIndentSpaces: 4 });
    expect(savedPrefs.lastActiveTool).toBe('jwt-decoder');
    expect(savedPrefs.jsonIndentSpaces).toBe(4);
  });

  it('round-trips GraphQL, WebSocket, and SSE requests in Postman v2.1 with _api_studio metadata and strips secrets when requested', async () => {
    await db.collections.add({
      id: 'col-multi',
      name: 'Multi Protocol Collection',
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    const gqlReq = { ...createDefaultRequest('GraphQL Users', 'POST'), requestType: 'graphql' as const };
    gqlReq.id = 'r-gql';
    gqlReq.collectionId = 'col-multi';
    gqlReq.graphql = {
      endpoint: 'https://api.test/graphql',
      method: 'POST',
      query: 'query { users { id } }',
      variablesText: '{"limit":5}',
      queryHistory: [],
    };

    const wsReq = { ...createDefaultRequest('Live Socket', 'GET'), requestType: 'websocket' as const };
    wsReq.id = 'r-ws';
    wsReq.collectionId = 'col-multi';
    wsReq.websocket = {
      url: 'wss://ws.test/feed',
      protocols: ['v1'],
      autoReconnect: true,
      reconnectDelayMs: 1000,
      maxReconnectAttempts: 3,
      connectionTimeoutMs: 5000,
      heartbeatEnabled: true,
      heartbeatIntervalMs: 10000,
      heartbeatMessage: 'ping',
      templates: [],
      retainHistory: false,
      historyLimit: 100,
    };

    const sseReq = { ...createDefaultRequest('Event Stream', 'GET'), requestType: 'sse' as const };
    sseReq.id = 'r-sse';
    sseReq.collectionId = 'col-multi';
    sseReq.sse = {
      url: 'https://api.test/events',
      connectionMode: 'fetch',
      headers: [],
      auth: { type: 'bearer', bearer: { token: 'super-secret-sse-token' } },
      withCredentials: false,
      autoReconnect: true,
      reconnectDelayMs: 2000,
      maxReconnectAttempts: 3,
      retainHistory: false,
      historyLimit: 100,
    };

    await db.requests.bulkAdd([gqlReq, wsReq, sseReq]);

    const postmanBundle = await exporter.exportPostmanV21('col-multi', { includeSecrets: false });
    expect(postmanBundle.item).toHaveLength(3);
    const exportedSse = postmanBundle.item.find((i: any) => i.name === 'Event Stream');
    expect(exportedSse._api_studio.sse.auth.type).toBe('none');

    const parsed = importer.parseInput(JSON.stringify(postmanBundle));
    expect(parsed.requests).toHaveLength(3);
    expect(parsed.requests.find((r) => r.name === 'GraphQL Users')?.requestType).toBe('graphql');
    expect(parsed.requests.find((r) => r.name === 'Live Socket')?.websocket?.url).toBe('wss://ws.test/feed');
    expect(parsed.requests.find((r) => r.name === 'Event Stream')?.requestType).toBe('sse');
  });

  it('evaluates JSONPath queries accurately and catches invalid syntax', () => {
    const sample = {
      store: {
        books: [
          { title: 'Clean Code', price: 32 },
          { title: 'Designing Data-Intensive Applications', price: 45 },
        ],
      },
    };
    const res = evaluateJsonPath(sample, '$.store.books[*].title');
    expect(res.valid).toBe(true);
    expect(res.values).toEqual(['Clean Code', 'Designing Data-Intensive Applications']);

    const bad = evaluateJsonPath(sample, '$.store.books[');
    expect(bad.valid).toBe(false);
    expect(bad.error).toMatch(/unclosed bracket/i);
  });

  it('masks sensitive credentials in request previews and explains Fetch diagnostics honestly', () => {
    const req = createDefaultRequest('Secure Call', 'GET');
    req.url = 'https://api.test/items?apiKey={{missingKey}}';
    req.auth = { type: 'bearer', bearer: { token: 'my-live-jwt-secret' } };
    req.headers = [{ id: 'h1', key: 'X-Api-Key', value: 'raw-key-999', enabled: true }];

    const preview = buildRequestPreviewSummary(req, {});
    expect(preview.authSummary.maskedSummary).not.toContain('my-live-jwt-secret');
    expect(preview.headersAttempted.find((h) => h.key === 'X-Api-Key')?.value).not.toContain('raw-key-999');
    expect(preview.unresolvedVariables).toContain('missingKey');

    const diag = analyzeRequestDiagnostics(req, {}, {
      id: 'err-1',
      requestId: req.id,
      status: 0,
      statusText: 'NETWORK_ERROR',
      ok: false,
      url: req.url,
      method: req.method,
      headers: {},
      cookies: [],
      tests: [],
      timeMs: 12,
      timing: {
        startTime: Date.now() - 12,
        endTime: Date.now(),
        duration: 12,
        prepareMs: 1,
        waitingMs: 11,
        downloadMs: 0,
      },
      size: 0,
      sizeBytes: 0,
      body: '',
      rawBody: '',
      contentType: 'text/plain',
      contentTypeCategory: 'text',
      receivedAt: new Date().toISOString(),
      timestamp: Date.now(),
      error: {
        type: 'cors',
        message: 'Failed to fetch due to CORS policy',
      },
    });

    expect(diag.some((d) => d.category === 'possible_cors')).toBe(true);
  });
});
