import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildMetricsSummary,
  computePercentile,
  exportPerformanceRunAsCsv,
  exportPerformanceRunAsHtml,
  exportPerformanceRunAsJson,
  getModePreset,
  MAX_DURATION_SECONDS,
  MAX_RPS,
  MAX_VIRTUAL_USERS,
  runPerformanceTest,
  validatePerformanceConfig,
} from '../../services/performance/performanceEngine';
import {
  aggregateErrorAnalytics,
  applyHeaderRedaction,
  buildTraceFromHistoryEntry,
  classifyErrorCategory,
  DEFAULT_REDACTION_CONFIG,
  exportTracesAsJson,
  extractTraceCorrelation,
  maskSecretValue,
  redactJsonPayload,
} from '../../services/observability/observabilityService';
import { createDefaultRequest } from '../../stores/requestStore';
import { httpClient } from '../../services/http/httpClient';
import { ApiResponse, HistoryItem, PerformanceTestConfig } from '../../types';

function makeApiResponse(status: number, timeMs: number, headers: Record<string, string> = {}): ApiResponse {
  const now = Date.now();
  return {
    id: `resp-${Math.random()}`,
    requestId: 'req-1',
    url: 'https://api.example.com/health',
    method: 'GET',
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    ok: status >= 200 && status < 300,
    headers,
    body: '{"ok":true}',
    rawBody: '{"ok":true}',
    contentType: 'application/json',
    contentTypeCategory: 'json',
    size: 11,
    sizeBytes: 11,
    timeMs,
    timing: {
      startTime: now - timeMs,
      endTime: now,
      duration: timeMs,
      prepareMs: 1,
      waitingMs: Math.max(1, timeMs - 2),
      downloadMs: 1,
    },
    receivedAt: new Date(now).toISOString(),
    timestamp: now,
    cookies: [],
    tests: [],
  };
}

describe('Phase 9: Performance Testing & Observability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes exact linear-interpolated percentiles and flags approximate sample caps', () => {
    expect(computePercentile([], 95)).toBe(0);
    expect(computePercentile([42], 99)).toBe(42);

    const sorted = [10, 20, 30, 40, 50];
    expect(computePercentile(sorted, 50)).toBe(30);
    // rank for p90 on 5 items: 0.9 * 4 = 3.6 -> 40*0.4 + 50*0.6 = 46
    expect(computePercentile(sorted, 90)).toBeCloseTo(46, 5);

    const exactSummary = buildMetricsSummary({
      latenciesMs: [50, 10, 30, 20, 40],
      totalRequests: 5,
      successfulRequests: 4,
      failedRequests: 1,
      timeoutCount: 0,
      totalBytesReceived: 1000,
      durationMs: 2000,
      statusCodeDistribution: { '200': 4, '500': 1 },
      percentilesApproximate: false,
    });
    expect(exactSummary.medianResponseTimeMs).toBe(30);
    expect(exactSummary.minResponseTimeMs).toBe(10);
    expect(exactSummary.maxResponseTimeMs).toBe(50);
    expect(exactSummary.errorRatePercent).toBe(20);
    expect(exactSummary.percentilesApproximate).toBe(false);
    expect(exactSummary.percentileNote).toBeUndefined();

    const approxSummary = buildMetricsSummary({
      latenciesMs: [12, 18],
      totalRequests: 60000,
      successfulRequests: 60000,
      failedRequests: 0,
      timeoutCount: 0,
      totalBytesReceived: 60000,
      durationMs: 5000,
      statusCodeDistribution: { '200': 60000 },
      percentilesApproximate: true,
    });
    expect(approxSummary.percentilesApproximate).toBe(true);
    expect(approxSummary.percentileNote).toContain('50,000');
  });

  it('enforces performance test guardrails and requires explicit execution confirmation', async () => {
    const baseConfig: PerformanceTestConfig = {
      id: 'pcfg-1',
      name: 'Auth Stress Check',
      requestIds: ['req-1'],
      mode: 'load',
      virtualUsers: 5,
      durationSeconds: 1,
      rampUpSeconds: 0,
      rampDownSeconds: 0,
      requestDelayMs: 50,
      maxRequestsPerSecond: 50,
      timeoutMs: 5000,
      errorThresholdPercent: 5,
      confirmedExecution: false,
      createdAt: 1,
      updatedAt: 1,
    };

    expect(validatePerformanceConfig(baseConfig)).toHaveLength(0);
    expect(getModePreset('smoke').virtualUsers).toBe(2);

    const unsafe = {
      ...baseConfig,
      virtualUsers: MAX_VIRTUAL_USERS + 1,
      durationSeconds: MAX_DURATION_SECONDS + 1,
      maxRequestsPerSecond: MAX_RPS + 1,
    };
    const errs = validatePerformanceConfig(unsafe);
    expect(errs.length).toBeGreaterThanOrEqual(3);

    const req = {
      ...createDefaultRequest('Health', 'GET'),
      url: 'https://api.example.com/health',
    };
    await expect(
      runPerformanceTest({
        runId: 'prun-unconfirmed',
        config: baseConfig,
        targetRequests: [req],
        resolvedVariables: {},
      })
    ).rejects.toThrow(/confirmation/i);

    vi.spyOn(httpClient, 'execute').mockResolvedValue(makeApiResponse(200, 15));
    const { run, samples } = await runPerformanceTest({
      runId: 'prun-1',
      config: { ...baseConfig, virtualUsers: 2, durationSeconds: 1, confirmedExecution: true },
      targetRequests: [req],
      resolvedVariables: {},
    });

    expect(run.status).toBe('completed');
    expect(run.summary.totalRequests).toBeGreaterThan(0);
    expect(run.summary.successfulRequests).toBe(run.summary.totalRequests);
    expect(samples.length).toBeGreaterThanOrEqual(1);

    const jsonOut = exportPerformanceRunAsJson(run, samples);
    expect(JSON.parse(jsonOut).run.id).toBe('prun-1');
    expect(exportPerformanceRunAsCsv(samples)).toContain('elapsed_seconds,active_virtual_users');
    expect(exportPerformanceRunAsHtml(run)).toContain('Performance Test Report: Auth Stress Check');
  });

  it('distinguishes transmitted trace headers from local tracking IDs and classifies error categories', () => {
    const withHeaders = extractTraceCorrelation(
      { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
      { 'X-Request-ID': 'req-abc-99' },
      'hist-1'
    );
    expect(withHeaders.transmittedHeadersPresent).toBe(true);
    expect(withHeaders.traceparent).toContain('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(withHeaders.xRequestId).toBe('req-abc-99');
    expect(withHeaders.localTrackingId).toBe('local-hist-1');

    const localOnly = extractTraceCorrelation({}, {}, 'hist-2');
    expect(localOnly.transmittedHeadersPresent).toBe(false);
    expect(localOnly.localTrackingId).toBe('local-hist-2');

    expect(classifyErrorCategory(0, 'Connection timed out', 'timeout')).toBe('timeout');
    expect(classifyErrorCategory(0, 'ENOTFOUND api.internal')).toBe('dns');
    expect(classifyErrorCategory(0, 'TLS certificate expired')).toBe('tls');
    expect(classifyErrorCategory(401)).toBe('authentication');
    expect(classifyErrorCategory(503)).toBe('application');
    expect(classifyErrorCategory(404)).toBe('http-status');
    expect(classifyErrorCategory(200)).toBe('none');
  });

  it('redacts sensitive headers and JSON keys on view and export and aggregates trace errors', () => {
    expect(maskSecretValue('secret-value-9999', 'partial')).toBe('secr••••9999');
    expect(maskSecretValue('secret-value-9999', 'full')).toBe('••••••••');

    const redactedHeaders = applyHeaderRedaction(
      {
        Authorization: 'Bearer super-secret-token',
        'Content-Type': 'application/json',
        'X-API-Key': 'key-1234567890',
      },
      DEFAULT_REDACTION_CONFIG
    );
    expect(redactedHeaders.Authorization).not.toContain('super-secret-token');
    expect(redactedHeaders['X-API-Key']).not.toContain('123456');
    expect(redactedHeaders['Content-Type']).toBe('application/json');

    const redactedJson = redactJsonPayload(
      JSON.stringify({ user: 'alice', password: 'my-secret-password', nested: { access_token: 'tok-abcdefghi' } }),
      DEFAULT_REDACTION_CONFIG
    );
    expect(redactedJson).not.toContain('my-secret-password');
    expect(redactedJson).not.toContain('tok-abcdefghi');
    expect(redactedJson).toContain('alice');

    const histItem: HistoryItem = {
      id: 'h-trace-1',
      url: 'https://payments.example.com/v1/charge',
      method: 'POST',
      status: 502,
      statusText: 'Bad Gateway',
      timeMs: 240,
      sizeBytes: 120,
      timestamp: Date.now(),
      executionResult: 'error',
      errorSummary: 'Upstream 502',
      request: {
        ...createDefaultRequest('Charge', 'POST'),
        url: 'https://payments.example.com/v1/charge',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer secret-xyz-12345', enabled: true }],
      },
      responseHeaders: { 'Set-Cookie': 'sid=confidential-session-token' },
    };

    const trace = buildTraceFromHistoryEntry(histItem, 'Payments', 'Production', DEFAULT_REDACTION_CONFIG);
    expect(trace.host).toBe('payments.example.com');
    expect(trace.errorCategory).toBe('application');
    expect(trace.redactedRequestHeaders.Authorization).not.toContain('secret-xyz-12345');

    const errorStats = aggregateErrorAnalytics([trace]);
    expect(errorStats).toHaveLength(1);
    expect(errorStats[0].category).toBe('application');
    expect(errorStats[0].sampleHosts).toContain('payments.example.com');

    const exported = exportTracesAsJson([trace], DEFAULT_REDACTION_CONFIG);
    expect(exported).not.toContain('secret-xyz-12345');
    expect(exported).not.toContain('confidential-session-token');
  });
});
