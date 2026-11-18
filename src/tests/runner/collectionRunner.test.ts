import { describe, it, expect } from 'vitest';
import {
  CollectionRunnerController,
  parseCsvIterationData,
  parseJsonIterationData,
  runCollectionPipeline,
} from '../../services/testing/collectionRunner';
import { createDefaultRequest } from '../../stores/requestStore';
import { ApiRequest, ApiResponse, RunnerConfig } from '../../types';

function makeReq(id: string, name: string, partial: Partial<ApiRequest> = {}): ApiRequest {
  const base = createDefaultRequest(name, 'GET');
  return { ...base, id, ...partial };
}

function makeHttpResponse(req: ApiRequest, resolvedUrl: string, status = 200, bodyObj: unknown = { ok: true }): ApiResponse {
  const body = JSON.stringify(bodyObj);
  return {
    id: `res-${req.id}-${Date.now()}`,
    requestId: req.id,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    ok: status >= 200 && status < 300,
    url: resolvedUrl,
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
    body,
    rawBody: body,
    contentType: 'application/json',
    contentTypeCategory: 'json',
    size: body.length,
    sizeBytes: body.length,
    timeMs: 25,
    timing: { startTime: 0, endTime: 25, duration: 25, prepareMs: 1, waitingMs: 22, downloadMs: 2 },
    receivedAt: new Date().toISOString(),
    timestamp: Date.now(),
    cookies: [],
    tests: [],
  };
}

describe('Phase 5: Collection Runner Engine', () => {
  it('23-24-25. runs requests sequentially, chains variables between requests, and computes metrics', async () => {
    const req1 = makeReq('r1', 'Login', {
      url: 'https://api.test/login',
      scripts: {
        preRequest: { script: 'pm.environment.set("nonce", "n123");', enabled: true },
        postResponse: {
          script: `
            const d = pm.response.json();
            pm.environment.set("auth_token", d.token);
            pm.test("got token", () => pm.expect(d.token).to.equal("tok-999"));
          `,
          enabled: true,
        },
      },
    });
    const req2 = makeReq('r2', 'Profile', {
      url: 'https://api.test/profile?token={{auth_token}}&nonce={{nonce}}',
      scripts: {
        preRequest: { script: '', enabled: false },
        postResponse: {
          script: 'pm.test("profile ok", () => pm.response.to.have.status(200));',
          enabled: true,
        },
      },
    });

    const seenUrls: string[] = [];
    const config: RunnerConfig = {
      requests: [
        { requestId: 'r1', name: 'Login', method: 'GET', url: req1.url, enabled: true, order: 1 },
        { requestId: 'r2', name: 'Profile', method: 'GET', url: req2.url, enabled: true, order: 2 },
      ],
      environmentId: 'env-1',
      iterations: 1,
      delayMs: 0,
      failureMode: 'continue',
      timeoutMs: 5000,
      iterationData: [],
    };

    const { progress, results } = await runCollectionPipeline({
      config,
      requestLookup: { r1: req1, r2: req2 },
      httpExecutor: async (req, opts) => {
        let resolved = req.url;
        for (const [k, v] of Object.entries(opts.resolvedVariables || {})) {
          resolved = resolved.replaceAll(`{{${k}}}`, v);
        }
        seenUrls.push(resolved);
        return req.id === 'r1'
          ? makeHttpResponse(req, resolved, 200, { token: 'tok-999' })
          : makeHttpResponse(req, resolved, 200, { user: 'ada' });
      },
    });

    expect(progress.status).toBe('completed');
    expect(progress.passedRequests).toBe(2);
    expect(progress.passedAssertions).toBe(2);
    expect(seenUrls[1]).toBe('https://api.test/profile?token=tok-999&nonce=n123');
    expect(results).toHaveLength(2);
  });

  it('26-27-28. parses CSV & JSON iteration data and executes multiple iterations with data binding', async () => {
    const csvRows = parseCsvIterationData('userId,role\n101,"admin,lead"\n102,viewer');
    expect(csvRows).toEqual([
      { userId: '101', role: 'admin,lead' },
      { userId: '102', role: 'viewer' },
    ]);

    const jsonRows = parseJsonIterationData('[{"userId":"u1"},{"userId":"u2"},{"userId":"u3"}]');
    expect(jsonRows).toHaveLength(3);

    const req = makeReq('r-iter', 'Get User', {
      url: 'https://api.test/users/{{userId}}',
      scripts: {
        preRequest: { script: '', enabled: false },
        postResponse: {
          script: `
            pm.test("iteration id matches", () => {
              pm.expect(pm.response.json().id).to.equal(pm.iterationData.get("userId"));
            });
          `,
          enabled: true,
        },
      },
    });

    const { progress, results } = await runCollectionPipeline({
      config: {
        requests: [
          { requestId: 'r-iter', name: 'Get User', method: 'GET', url: req.url, enabled: true, order: 1 },
        ],
        environmentId: null,
        iterations: 3,
        delayMs: 0,
        failureMode: 'continue',
        timeoutMs: 5000,
        iterationData: jsonRows,
      },
      requestLookup: { 'r-iter': req },
      httpExecutor: async (r, opts) => {
        const uid = opts.resolvedVariables?.userId || '';
        return makeHttpResponse(r, `https://api.test/users/${uid}`, 200, { id: uid });
      },
    });

    expect(results).toHaveLength(3);
    expect(progress.passedRequests).toBe(3);
    expect(results.map((r) => r.resolvedUrl)).toEqual([
      'https://api.test/users/u1',
      'https://api.test/users/u2',
      'https://api.test/users/u3',
    ]);
  });

  it('29-30-31. respects environment variables and stop-on-failure vs continue-on-failure', async () => {
    const failReq = makeReq('rf', 'Fail Step', {
      url: '{{host}}/fail',
      assertions: [
        { id: 'a1', name: 'must be 200', enabled: true, order: 1, category: 'status', operator: 'equals', expectedValue: '200' },
      ],
    });
    const nextReq = makeReq('rn', 'Next Step', { url: '{{host}}/next' });

    const baseConfig: RunnerConfig = {
      requests: [
        { requestId: 'rf', name: 'Fail Step', method: 'GET', url: failReq.url, enabled: true, order: 1 },
        { requestId: 'rn', name: 'Next Step', method: 'GET', url: nextReq.url, enabled: true, order: 2 },
      ],
      environmentId: 'env-staging',
      iterations: 1,
      delayMs: 0,
      failureMode: 'stop',
      timeoutMs: 5000,
      iterationData: [],
    };

    const envVars = [
      {
        id: 'e1',
        key: 'host',
        initialValue: 'https://staging.api',
        currentValue: 'https://staging.api',
        description: '',
        enabled: true,
        isSecret: false,
      },
    ];

    const stopRun = await runCollectionPipeline({
      config: baseConfig,
      requestLookup: { rf: failReq, rn: nextReq },
      environmentVariables: envVars,
      httpExecutor: async (r, opts) => {
        const url = r.url.replace('{{host}}', opts.resolvedVariables?.host || '');
        return makeHttpResponse(r, url, r.id === 'rf' ? 500 : 200);
      },
    });

    expect(stopRun.results).toHaveLength(1);
    expect(stopRun.results[0].resolvedUrl).toBe('https://staging.api/fail');
    expect(stopRun.progress.failedRequests).toBe(1);

    const contRun = await runCollectionPipeline({
      config: { ...baseConfig, failureMode: 'continue' },
      requestLookup: { rf: failReq, rn: nextReq },
      environmentVariables: envVars,
      httpExecutor: async (r, opts) => {
        const url = r.url.replace('{{host}}', opts.resolvedVariables?.host || '');
        return makeHttpResponse(r, url, r.id === 'rf' ? 500 : 200);
      },
    });

    expect(contRun.results).toHaveLength(2);
    expect(contRun.progress.failedRequests).toBe(1);
    expect(contRun.progress.passedRequests).toBe(1);
  });

  it('32. supports Pause, Resume, and Stop cancellation mid-run', async () => {
    const r1 = makeReq('p1', 'Step 1', { url: 'https://api.test/1' });
    const r2 = makeReq('p2', 'Step 2', { url: 'https://api.test/2' });
    const r3 = makeReq('p3', 'Step 3', { url: 'https://api.test/3' });

    let ctrl!: CollectionRunnerController;

    // Test pause & resume
    const pauseRunPromise = runCollectionPipeline({
      config: {
        requests: [
          { requestId: 'p1', name: 'Step 1', method: 'GET', url: r1.url, enabled: true, order: 1 },
          { requestId: 'p2', name: 'Step 2', method: 'GET', url: r2.url, enabled: true, order: 2 },
        ],
        environmentId: null,
        iterations: 1,
        delayMs: 0,
        failureMode: 'continue',
        timeoutMs: 5000,
        iterationData: [],
      },
      requestLookup: { p1: r1, p2: r2 },
      controllerRef: (c) => {
        ctrl = c;
      },
      onResult: (res) => {
        if (res.requestId === 'p1') {
          ctrl.pause();
          expect(ctrl.getStatus()).toBe('paused');
          setTimeout(() => ctrl.resume(), 30);
        }
      },
      httpExecutor: async (r) => makeHttpResponse(r, r.url, 200),
    });

    const pauseOut = await pauseRunPromise;
    expect(pauseOut.progress.status).toBe('completed');
    expect(pauseOut.results).toHaveLength(2);

    // Test stop mid-run
    const stopPromise = runCollectionPipeline({
      config: {
        requests: [
          { requestId: 'p1', name: 'Step 1', method: 'GET', url: r1.url, enabled: true, order: 1 },
          { requestId: 'p2', name: 'Step 2', method: 'GET', url: r2.url, enabled: true, order: 2 },
          { requestId: 'p3', name: 'Step 3', method: 'GET', url: r3.url, enabled: true, order: 3 },
        ],
        environmentId: null,
        iterations: 1,
        delayMs: 0,
        failureMode: 'continue',
        timeoutMs: 5000,
        iterationData: [],
      },
      requestLookup: { p1: r1, p2: r2, p3: r3 },
      controllerRef: (c) => {
        ctrl = c;
      },
      onResult: (res) => {
        if (res.requestId === 'p1') ctrl.stop();
      },
      httpExecutor: async (r) => makeHttpResponse(r, r.url, 200),
    });

    const stopOut = await stopPromise;
    expect(stopOut.progress.status).toBe('stopped');
    expect(stopOut.results).toHaveLength(1);
  });
});
