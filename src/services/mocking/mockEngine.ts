import {
  MockEndpointRule,
  MockRequestLog,
  MockServerConfig,
  MockServerStatus,
  OpenApiParsedDoc,
} from '../../types';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from '../desktop/tauriBridge';

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Restricted safe template evaluator (NO eval / Function / arbitrary JS).
 * Supports {{path.param}}, {{query.param}}, {{$uuid}}, {{$timestamp}}, {{$isoTimestamp}}, {{$randomInt}}.
 */
export function renderSafeMockTemplate(
  template: string,
  context: {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
  } = {}
): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, rawExpr) => {
    const expr = String(rawExpr).trim();
    if (expr === '$uuid') {
      return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `uuid-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    }
    if (expr === '$timestamp') {
      return String(Math.floor(Date.now() / 1000));
    }
    if (expr === '$isoTimestamp') {
      return new Date().toISOString();
    }
    if (expr === '$randomInt') {
      return String(Math.floor(Math.random() * 10000));
    }
    if (expr.startsWith('path.')) {
      const key = expr.slice(5);
      return context.pathParams?.[key] ?? '';
    }
    if (expr.startsWith('query.')) {
      const key = expr.slice(6);
      return context.queryParams?.[key] ?? '';
    }
    return `{{${expr}}}`;
  });
}

export function matchMockRoute(
  endpoints: MockEndpointRule[],
  method: string,
  requestPathWithQuery: string
): {
  endpoint?: MockEndpointRule;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
} {
  const [rawPath, rawQuery = ''] = requestPathWithQuery.split('?');
  const reqSegments = rawPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const queryParams: Record<string, string> = {};
  if (rawQuery) {
    const usp = new URLSearchParams(rawQuery);
    usp.forEach((v, k) => {
      queryParams[k] = v;
    });
  }

  for (const ep of endpoints) {
    if (!ep.enabled) continue;
    if (ep.method.toUpperCase() !== method.toUpperCase()) continue;

    const epPath = ep.path.split('?')[0];
    const epSegments = epPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (epSegments.length !== reqSegments.length) continue;

    const pathParams: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < epSegments.length; i++) {
      const seg = epSegments[i];
      const reqSeg = reqSegments[i];
      if (seg.startsWith(':')) {
        pathParams[seg.slice(1)] = decodeURIComponent(reqSeg);
      } else if (seg.startsWith('{') && seg.endsWith('}')) {
        pathParams[seg.slice(1, -1)] = decodeURIComponent(reqSeg);
      } else if (seg !== reqSeg) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { endpoint: ep, pathParams, queryParams };
    }
  }

  return { pathParams: {}, queryParams };
}

export function generateMockEndpointsFromSpec(
  serverId: string,
  parsedDoc: OpenApiParsedDoc
): MockEndpointRule[] {
  return parsedDoc.endpoints.map((ep, idx) => {
    const successResp =
      ep.responses.find((r) => r.statusCode.startsWith('2')) || ep.responses[0];
    const statusCode = Number(successResp?.statusCode) || 200;
    const body =
      successResp?.exampleJson ||
      JSON.stringify(
        {
          message: `Mocked ${ep.method} ${ep.path}`,
          requestId: '{{$uuid}}',
          timestamp: '{{$isoTimestamp}}',
        },
        null,
        2
      );

    return {
      id: makeId(`mep-${idx}`),
      serverId,
      method: ep.method,
      path: ep.path.replace(/\{([^}]+)\}/g, ':$1'),
      enabled: true,
      statusCode: Number.isFinite(statusCode) ? statusCode : 200,
      headers: {
        'X-Mock-Source': parsedDoc.title,
      },
      contentType: 'application/json',
      delayMs: 25,
      body,
      description: ep.summary || `Generated from ${ep.method} ${ep.path}`,
    };
  });
}

export function simulateLocalMockDispatch(
  server: MockServerConfig,
  method: string,
  pathWithQuery: string,
  requestHeaders: Record<string, string> = {},
  requestBody = ''
): {
  status: number;
  headers: Record<string, string>;
  body: string;
  log: MockRequestLog;
} {
  const started = Date.now();
  const { endpoint, pathParams, queryParams } = matchMockRoute(
    server.endpoints,
    method,
    pathWithQuery
  );

  const [pathOnly, queryOnly = ''] = pathWithQuery.split('?');

  if (!endpoint) {
    const notFoundBody = JSON.stringify(
      {
        error: 'MOCK_ROUTE_NOT_FOUND',
        message: `No enabled mock route matched ${method.toUpperCase()} ${pathOnly}`,
      },
      null,
      2
    );
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: notFoundBody,
      log: {
        id: makeId('mlog'),
        serverId: server.id,
        timestamp: started,
        method: method.toUpperCase(),
        path: pathOnly,
        query: queryOnly,
        headers: requestHeaders,
        requestBody,
        responseStatus: 404,
        responseTimeMs: Math.max(1, Date.now() - started),
        remoteAddr: 'in-app-simulator',
      },
    };
  }

  const renderedBody = renderSafeMockTemplate(endpoint.body, { pathParams, queryParams });
  const headers: Record<string, string> = {
    'Content-Type': endpoint.contentType || 'application/json',
    ...endpoint.headers,
  };

  return {
    status: endpoint.statusCode,
    headers,
    body: renderedBody,
    log: {
      id: makeId('mlog'),
      serverId: server.id,
      timestamp: started,
      method: method.toUpperCase(),
      path: pathOnly,
      query: queryOnly,
      headers: requestHeaders,
      requestBody,
      matchedEndpointId: endpoint.id,
      responseStatus: endpoint.statusCode,
      responseTimeMs: endpoint.delayMs || 1,
      remoteAddr: 'in-app-simulator',
    },
  };
}

export class NativeMockServerBridge {
  public async startServer(config: MockServerConfig): Promise<MockServerStatus> {
    if (!isTauriRuntime()) {
      throw new Error(
        'Binding a real host HTTP port requires the Tauri Desktop runtime. You can still test routes locally using the In-App Simulator.'
      );
    }
    return invokeDesktop<MockServerStatus>('mock_start_server', { config });
  }

  public async stopServer(serverId: string): Promise<MockServerStatus> {
    if (!isTauriRuntime()) {
      return { serverId, running: false, port: 0, requestCount: 0 };
    }
    return invokeDesktop<MockServerStatus>('mock_stop_server', { serverId });
  }

  public async updateRoutes(config: MockServerConfig): Promise<void> {
    if (!isTauriRuntime()) return;
    return invokeDesktop<void>('mock_update_routes', { config });
  }

  public async getServerStatus(serverId: string): Promise<MockServerStatus | null> {
    if (!isTauriRuntime()) return null;
    return invokeDesktop<MockServerStatus | null>('mock_server_status', { serverId });
  }
}

export const nativeMockServerBridge = new NativeMockServerBridge();
