import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestExecutor } from '../../services/http/requestExecutor';
import { ApiRequest } from '../../types';
import { createDefaultRequest } from '../../stores/requestStore';

describe('requestExecutor', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const sampleRequest: ApiRequest = {
    ...createDefaultRequest('Sample Request', 'GET'),
    id: 'req-exec-1',
    url: 'https://api.example.com/status',
    params: [],
    headers: [],
    auth: { type: 'none' },
  };

  it('1. executes a successful GET request and returns normalized ApiResponse', async () => {
    const mockResponseBody = JSON.stringify({ status: 'ok', uptime: 99.9 });
    global.fetch = vi.fn().mockResolvedValue(
      new Response(mockResponseBody, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Server-Version': '3.0.0',
        },
      })
    );

    const response = await requestExecutor.execute(sampleRequest, { tabId: 'tab-1' });

    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(response.ok).toBe(true);
    expect(response.headers['x-server-version']).toBe('3.0.0');
    expect(response.contentTypeCategory).toBe('json');
    expect((response.parsedBody as any).status).toBe('ok');
    expect(response.timing).toBeDefined();
    expect(response.timing.duration).toBeGreaterThanOrEqual(0);
  });

  it('2. captures post-response test assertions', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 200 }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const testReq: ApiRequest = {
      ...sampleRequest,
      scripts: {
        preRequest: { script: '', enabled: true },
        postResponse: {
          enabled: true,
          script: `
            pm.test("Status is 200", function () {
              pm.response.to.have.status(200);
            });
            pm.test("Status is 404 should fail", function () {
              pm.response.to.have.status(404);
            });
          `,
        },
      },
    };

    const response = await requestExecutor.execute(testReq, { tabId: 'tab-tests' });
    expect(response.tests.length).toBe(2);
    expect(response.tests[0].name).toBe('Status is 200');
    expect(response.tests[0].passed).toBe(true);
    expect(response.tests[1].name).toBe('Status is 404 should fail');
    expect(response.tests[1].passed).toBe(false);
  });

  it('3. cancels in-flight request when cancel is called', async () => {
    // Hang fetch until aborted
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const err = new Error('Request was cancelled by user');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    const executionPromise = requestExecutor.execute(sampleRequest, { tabId: 'tab-cancel' });

    // Cancel shortly after
    setTimeout(() => {
      requestExecutor.cancel('tab-cancel');
    }, 10);

    const response = await executionPromise;
    expect(response.status).toBe(0);
    expect(response.error?.type).toBe('abort');
    expect(response.error?.message).toContain('cancelled by user');
  });

  it('4. supports multiple independent tab executions without mixing responses', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('tab-a')) {
        return Promise.resolve(new Response('Response for Tab A', { status: 200 }));
      }
      return Promise.resolve(new Response('Response for Tab B', { status: 201 }));
    });

    const reqA: ApiRequest = { ...sampleRequest, url: 'https://api.example.com/tab-a' };
    const reqB: ApiRequest = { ...sampleRequest, url: 'https://api.example.com/tab-b' };

    const [resA, resB] = await Promise.all([
      requestExecutor.execute(reqA, { tabId: 'tab-A' }),
      requestExecutor.execute(reqB, { tabId: 'tab-B' }),
    ]);

    expect(resA.status).toBe(200);
    expect(resA.body).toBe('Response for Tab A');

    expect(resB.status).toBe(201);
    expect(resB.body).toBe('Response for Tab B');
  });
});
