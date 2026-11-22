import {
  ApiRequest,
  GraphQLRequestConfig,
  HttpMethod,
  RequestProtocolType,
  SseConfig,
  WebSocketConfig,
} from '../../types';

export function createDefaultGraphQLConfig(endpoint = '{{base_url}}/graphql'): GraphQLRequestConfig {
  return {
    endpoint,
    method: 'POST',
    query: `query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n  }\n}`,
    variablesText: `{\n  "id": "1"\n}`,
    operationName: 'GetUser',
    queryHistory: [],
  };
}

export function createDefaultWebSocketConfig(url = 'wss://echo.websocket.events'): WebSocketConfig {
  return {
    url,
    protocols: [],
    connectionTimeoutMs: 10000,
    autoReconnect: false,
    maxReconnectAttempts: 3,
    reconnectDelayMs: 2000,
    heartbeatEnabled: false,
    heartbeatIntervalMs: 30000,
    heartbeatMessage: '{"type":"ping"}',
    templates: [],
    retainHistory: false,
    historyLimit: 200,
  };
}

export function createDefaultSseConfig(url = 'https://stream.wikimedia.org/v2/stream/recentchange'): SseConfig {
  return {
    url,
    connectionMode: 'auto',
    withCredentials: false,
    headers: [{ id: 'sse-h-1', key: 'Accept', value: 'text/event-stream', enabled: true }],
    auth: { type: 'none' },
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelayMs: 3000,
    retainHistory: false,
    historyLimit: 500,
  };
}

export function createProtocolAwareRequest(
  protocol: RequestProtocolType = 'http',
  name?: string,
  method: HttpMethod = 'GET'
): ApiRequest {
  const now = Date.now();
  const id = 'req-' + now + Math.random().toString(36).substring(2, 6);
  const defaultRawBody = '{\n  "name": "Acme User",\n  "status": "active"\n}';

  const baseName =
    name ||
    (protocol === 'graphql'
      ? 'New GraphQL Query'
      : protocol === 'websocket'
      ? 'New WebSocket'
      : protocol === 'sse'
      ? 'New SSE Stream'
      : 'New Request');

  const graphqlCfg = protocol === 'graphql' ? createDefaultGraphQLConfig() : undefined;
  const wsCfg = protocol === 'websocket' ? createDefaultWebSocketConfig() : undefined;
  const sseCfg = protocol === 'sse' ? createDefaultSseConfig() : undefined;

  const url =
    protocol === 'graphql'
      ? graphqlCfg!.endpoint
      : protocol === 'websocket'
      ? wsCfg!.url
      : protocol === 'sse'
      ? sseCfg!.url
      : '{{base_url}}/users';

  return {
    id,
    name: baseName,
    requestType: protocol,
    method: protocol === 'graphql' ? 'POST' : method,
    url,
    params: [{ id: 'p-1', key: '', value: '', description: '', enabled: true }],
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
      preRequest: {
        script: '// Pre-request script\n// pm.environment.set("current_time", Date.now());',
        enabled: true,
      },
      postResponse: {
        script: 'pm.test("Status is 200", function () {\n  pm.response.to.have.status(200);\n});',
        enabled: true,
      },
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
    graphql: graphqlCfg,
    websocket: wsCfg,
    sse: sseCfg,
    createdAt: now,
    updatedAt: now,
  };
}
