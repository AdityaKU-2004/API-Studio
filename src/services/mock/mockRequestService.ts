import { ApiRequest, ApiResponse, TestResult } from '../../types';
import { mockResponsesByUrl } from '../../data/mockData';

export interface IRequestService {
  executeRequest(request: ApiRequest, environmentVars?: Record<string, string>): Promise<ApiResponse>;
}

export class MockRequestService implements IRequestService {
  async executeRequest(request: ApiRequest, environmentVars: Record<string, string> = {}): Promise<ApiResponse> {
    // Simulate real network latency (140ms - 220ms)
    const simulatedDelay = Math.floor(Math.random() * 80) + 140;
    await new Promise((resolve) => setTimeout(resolve, simulatedDelay));

    // Resolve URL variables if any
    let resolvedUrl = request.url;
    for (const [key, val] of Object.entries(environmentVars)) {
      resolvedUrl = resolvedUrl.replaceAll(`{{${key}}}`, val);
    }

    const timestamp = Date.now();

    // Check if we have a tailored mock response
    let matchingMock = Object.entries(mockResponsesByUrl).find(([path]) => resolvedUrl.includes(path))?.[1];

    if (!matchingMock) {
      // Generate realistic mock response based on method and URL
      const isCreate = request.method === 'POST';
      const isDelete = request.method === 'DELETE';
      const statusCode = isDelete ? 204 : isCreate ? 201 : 200;
      const statusText = isDelete ? 'No Content' : isCreate ? 'Created' : 'OK';

      let bodyData: unknown = {};
      if (isDelete) {
        bodyData = null;
      } else if (isCreate) {
        let parsedBody: Record<string, unknown> = {};
        try {
          if (request.rawBody) {
            parsedBody = JSON.parse(request.rawBody);
          }
        } catch {
          parsedBody = { raw: request.rawBody };
        }
        bodyData = {
          id: 'gen_' + Math.random().toString(36).substring(2, 10),
          ...parsedBody,
          createdAt: new Date().toISOString(),
          statusMessage: 'Resource created successfully in API Studio simulation'
        };
      } else {
        bodyData = {
          status: 'success',
          requestedUrl: resolvedUrl,
          method: request.method,
          timestamp: new Date().toISOString(),
          data: [
            { id: 1, title: 'Item Alpha', status: 'verified', category: 'cloud' },
            { id: 2, title: 'Item Beta', status: 'pending', category: 'storage' },
            { id: 3, title: 'Item Gamma', status: 'active', category: 'compute' }
          ]
        };
      }

      const bodyStr = isDelete ? '' : JSON.stringify(bodyData, null, 2);

      const tests: TestResult[] = [
        { name: `Status code is ${statusCode} ${statusText}`, passed: true },
        { name: 'Response time is under 500ms', passed: simulatedDelay < 500 },
        { name: 'Valid JSON payload structure returned', passed: !isDelete },
      ];

      const sizeBytes = new Blob([bodyStr]).size + 420;
      return {
        id: 'mock-exec-' + timestamp,
        requestId: request.id,
        status: statusCode,
        statusText,
        ok: statusCode >= 200 && statusCode < 400,
        url: request.url,
        method: request.method,
        timeMs: simulatedDelay,
        size: sizeBytes,
        sizeBytes,
        timestamp,
        receivedAt: new Date(timestamp).toISOString(),
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-request-id': 'req_' + Math.random().toString(36).substring(2, 12),
          'x-response-time': `${simulatedDelay}ms`,
          'cache-control': 'no-cache, no-store, must-revalidate',
          'server': 'API-Studio-Mock-Engine/1.0',
        },
        cookies: [
          { name: 'studio_session', value: 'sess_' + Math.random().toString(36).substring(2, 10), domain: 'localhost', path: '/' }
        ],
        body: bodyStr,
        rawBody: bodyStr,
        contentType: 'application/json',
        contentTypeCategory: 'json',
        timing: {
          startTime: timestamp - simulatedDelay,
          endTime: timestamp,
          duration: simulatedDelay,
          prepareMs: 2,
          waitingMs: simulatedDelay - 4,
          downloadMs: 2,
        },
        tests
      };
    }

    const bodyStr = matchingMock.body || '{}';
    const sizeBytes = new Blob([bodyStr]).size + 512;
    return {
      id: 'mock-exec-' + timestamp,
      requestId: request.id,
      status: matchingMock.status || 200,
      statusText: matchingMock.statusText || 'OK',
      ok: (matchingMock.status || 200) < 400,
      url: request.url,
      method: request.method,
      timeMs: simulatedDelay,
      size: sizeBytes,
      sizeBytes,
      timestamp,
      receivedAt: new Date(timestamp).toISOString(),
      headers: matchingMock.headers || { 'content-type': 'application/json' },
      cookies: matchingMock.cookies || [],
      body: bodyStr,
      rawBody: bodyStr,
      contentType: 'application/json',
      contentTypeCategory: 'json',
      timing: {
        startTime: timestamp - simulatedDelay,
        endTime: timestamp,
        duration: simulatedDelay,
        prepareMs: 2,
        waitingMs: simulatedDelay - 4,
        downloadMs: 2,
      },
      tests: matchingMock.tests || [
        { name: 'Status code check', passed: true }
      ]
    };
  }
}

export const requestService = new MockRequestService();
