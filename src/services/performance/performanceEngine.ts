import {
  ApiRequest,
  LoadTestMode,
  PerformanceMetricSample,
  PerformanceMetricsSummary,
  PerformanceTestConfig,
  PerformanceTestRun,
} from '../../types';
import { httpClient } from '../http/httpClient';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from '../desktop/tauriBridge';
import { substituteVariables } from '../variables/variableResolver';

export const MAX_VIRTUAL_USERS = 200;
export const MAX_DURATION_SECONDS = 1800;
export const MAX_RPS = 1000;
export const MAX_CLIENT_LATENCY_SAMPLES = 50_000;

export function getModePreset(mode: LoadTestMode): Partial<PerformanceTestConfig> {
  switch (mode) {
    case 'smoke':
      return { virtualUsers: 2, durationSeconds: 10, rampUpSeconds: 0, maxRequestsPerSecond: 20 };
    case 'stress':
      return { virtualUsers: 50, durationSeconds: 30, rampUpSeconds: 10, maxRequestsPerSecond: 200 };
    case 'spike':
      return { virtualUsers: 80, durationSeconds: 20, rampUpSeconds: 2, maxRequestsPerSecond: 300 };
    case 'soak':
      return { virtualUsers: 15, durationSeconds: 120, rampUpSeconds: 10, maxRequestsPerSecond: 80 };
    case 'load':
    default:
      return { virtualUsers: 15, durationSeconds: 20, rampUpSeconds: 5, maxRequestsPerSecond: 100 };
  }
}

export function validatePerformanceConfig(config: PerformanceTestConfig): string[] {
  const errors: string[] = [];
  if (!config.name.trim()) errors.push('Test configuration name is required.');
  if (config.requestIds.length === 0) errors.push('Select at least one target request.');
  if (config.virtualUsers < 1 || config.virtualUsers > MAX_VIRTUAL_USERS) {
    errors.push(`Virtual users must be between 1 and ${MAX_VIRTUAL_USERS}.`);
  }
  if (config.durationSeconds < 1 || config.durationSeconds > MAX_DURATION_SECONDS) {
    errors.push(`Duration must be between 1 and ${MAX_DURATION_SECONDS} seconds.`);
  }
  if (config.maxRequestsPerSecond < 1 || config.maxRequestsPerSecond > MAX_RPS) {
    errors.push(`Max RPS cap must be between 1 and ${MAX_RPS}.`);
  }
  if (config.timeoutMs < 500 || config.timeoutMs > 120000) {
    errors.push('Request timeout must be between 500ms and 120,000ms.');
  }
  return errors;
}

export function computePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const rank = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const fraction = rank - lower;
  return sortedValues[lower] * (1 - fraction) + sortedValues[upper] * fraction;
}

export function buildMetricsSummary(params: {
  latenciesMs: number[];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeoutCount: number;
  totalBytesReceived: number;
  durationMs: number;
  statusCodeDistribution: Record<string, number>;
  percentilesApproximate: boolean;
}): PerformanceMetricsSummary {
  const sorted = [...params.latenciesMs].sort((a, b) => a - b);
  const elapsedSecs = Math.max(0.001, params.durationMs / 1000);
  const avg =
    sorted.length > 0 ? sorted.reduce((acc, v) => acc + v, 0) / sorted.length : 0;

  return {
    totalRequests: params.totalRequests,
    successfulRequests: params.successfulRequests,
    failedRequests: params.failedRequests,
    timeoutCount: params.timeoutCount,
    requestsPerSecond: Number((params.totalRequests / elapsedSecs).toFixed(2)),
    avgResponseTimeMs: Number(avg.toFixed(2)),
    minResponseTimeMs: sorted.length > 0 ? Number(sorted[0].toFixed(2)) : 0,
    maxResponseTimeMs: sorted.length > 0 ? Number(sorted[sorted.length - 1].toFixed(2)) : 0,
    medianResponseTimeMs: Number(computePercentile(sorted, 50).toFixed(2)),
    p90ResponseTimeMs: Number(computePercentile(sorted, 90).toFixed(2)),
    p95ResponseTimeMs: Number(computePercentile(sorted, 95).toFixed(2)),
    p99ResponseTimeMs: Number(computePercentile(sorted, 99).toFixed(2)),
    errorRatePercent:
      params.totalRequests > 0
        ? Number(((params.failedRequests / params.totalRequests) * 100).toFixed(2))
        : 0,
    totalBytesReceived: params.totalBytesReceived,
    throughputBytesPerSec: Number((params.totalBytesReceived / elapsedSecs).toFixed(2)),
    statusCodeDistribution: { ...params.statusCodeDistribution },
    sampleCount: sorted.length,
    percentilesApproximate: params.percentilesApproximate,
    percentileNote: params.percentilesApproximate
      ? `Percentiles calculated from capped ${MAX_CLIENT_LATENCY_SAMPLES.toLocaleString()} samples`
      : undefined,
  };
}

function resolveTargetRequest(
  req: ApiRequest,
  variables: Record<string, string>
): { id: string; name: string; method: string; url: string; headers: Record<string, string>; body?: string } {
  const headers: Record<string, string> = {};
  for (const h of req.headers) {
    if (h.enabled && h.key.trim()) {
      headers[substituteVariables(h.key, variables)] = substituteVariables(h.value, variables);
    }
  }
  const url = substituteVariables(req.url, variables);
  const rawText = req.rawBody || '';
  const body =
    req.bodyType !== 'none' && rawText
      ? substituteVariables(rawText, variables)
      : undefined;

  return {
    id: req.id,
    name: req.name,
    method: req.method,
    url,
    headers,
    body,
  };
}

export async function runPerformanceTest(params: {
  runId: string;
  config: PerformanceTestConfig;
  targetRequests: ApiRequest[];
  resolvedVariables: Record<string, string>;
  onSample?: (sample: PerformanceMetricSample) => void;
  signal?: AbortSignal;
}): Promise<{ run: PerformanceTestRun; samples: PerformanceMetricSample[] }> {
  const validationErrors = validatePerformanceConfig(params.config);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(' '));
  }
  if (!params.config.confirmedExecution) {
    throw new Error('Explicit user confirmation is required before running a load test.');
  }
  if (params.targetRequests.length === 0) {
    throw new Error('No matching executable requests were resolved for the performance test.');
  }

  const startedAt = Date.now();
  const targetEndpoints = params.targetRequests.map((r) =>
    substituteVariables(r.url, params.resolvedVariables)
  );

  // Use native Rust Tokio load engine when running inside Tauri desktop
  if (isTauriRuntime()) {
    const targets = params.targetRequests.map((r) =>
      resolveTargetRequest(r, params.resolvedVariables)
    );
    const nativeRes = await invokeDesktop<{
      runId: string;
      status: 'completed' | 'stopped' | 'failed';
      startedAt: number;
      completedAt: number;
      durationMs: number;
      summary: PerformanceMetricsSummary;
      samples: PerformanceMetricSample[];
      errorMessage?: string;
    }>('perf_run_test', {
      config: {
        runId: params.runId,
        mode: params.config.mode,
        virtualUsers: params.config.virtualUsers,
        durationSeconds: params.config.durationSeconds,
        rampUpSeconds: params.config.rampUpSeconds,
        rampDownSeconds: params.config.rampDownSeconds,
        requestDelayMs: params.config.requestDelayMs,
        maxRequestsPerSecond: params.config.maxRequestsPerSecond,
        timeoutMs: params.config.timeoutMs,
        verifySsl: true,
        targets,
      },
    });

    nativeRes.samples.forEach((s) => params.onSample?.(s));

    return {
      run: {
        id: params.runId,
        configId: params.config.id,
        configSnapshot: { ...params.config },
        targetEndpoints,
        status: nativeRes.status,
        startedAt: nativeRes.startedAt,
        completedAt: nativeRes.completedAt,
        durationMs: nativeRes.durationMs,
        summary: nativeRes.summary,
        errorMessage: nativeRes.errorMessage,
      },
      samples: nativeRes.samples,
    };
  }

  // Browser / Vitest bounded concurrency execution path via standardized httpClient
  const latenciesMs: number[] = [];
  let percentilesApproximate = false;
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let timeoutCount = 0;
  let totalBytesReceived = 0;
  const statusDist: Record<string, number> = {};
  const samples: PerformanceMetricSample[] = [];

  const endTime = startedAt + params.config.durationSeconds * 1000;
  const minDelayBetweenCalls = Math.max(
    params.config.requestDelayMs,
    Math.floor(1000 / Math.max(1, params.config.maxRequestsPerSecond))
  );

  let stoppedEarly = false;
  const samplerTimer = setInterval(() => {
    const elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
    const avg =
      latenciesMs.length > 0
        ? latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length
        : 0;
    const sample: PerformanceMetricSample = {
      id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      runId: params.runId,
      timestamp: Date.now(),
      elapsedSeconds,
      activeVirtualUsers: params.config.virtualUsers,
      currentRps: Number(
        (totalRequests / Math.max(0.5, elapsedSeconds)).toFixed(2)
      ),
      avgResponseTimeMs: Number(avg.toFixed(2)),
      errorRatePercent:
        totalRequests > 0 ? Number(((failedRequests / totalRequests) * 100).toFixed(2)) : 0,
      throughputBytesPerSec: Number(
        (totalBytesReceived / Math.max(0.5, elapsedSeconds)).toFixed(2)
      ),
      statusCodes: { ...statusDist },
    };
    samples.push(sample);
    params.onSample?.(sample);
  }, 1000);

  const worker = async (vuIndex: number) => {
    if (params.config.rampUpSeconds > 0 && params.config.virtualUsers > 1) {
      const stagger =
        ((params.config.rampUpSeconds * 1000) / params.config.virtualUsers) * vuIndex;
      await new Promise((r) => setTimeout(r, Math.min(stagger, endTime - Date.now())));
    }

    let cursor = vuIndex;
    while (Date.now() < endTime && !params.signal?.aborted) {
      if (params.config.mode === 'spike' && vuIndex >= Math.max(1, Math.floor(params.config.virtualUsers / 3))) {
        const progress = (Date.now() - startedAt) / Math.max(1, params.config.durationSeconds * 1000);
        if (progress < 0.25 || progress > 0.75) {
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }
      }

      const reqTemplate = params.targetRequests[cursor % params.targetRequests.length];
      cursor++;

      const t0 = performance.now();
      try {
        const res = await httpClient.execute(reqTemplate, {
          tabId: `perf-${params.runId}-vu-${vuIndex}`,
          resolvedVariables: params.resolvedVariables,
          timeoutMs: params.config.timeoutMs,
        });
        const elapsed = res.timeMs > 0 ? res.timeMs : performance.now() - t0;
        totalRequests++;
        totalBytesReceived += res.sizeBytes || 0;

        if (res.error || res.status === 0 || res.status >= 400) {
          failedRequests++;
          if (res.error?.type === 'timeout') timeoutCount++;
          const codeKey = res.status > 0 ? String(res.status) : 'ERR';
          statusDist[codeKey] = (statusDist[codeKey] || 0) + 1;
        } else {
          successfulRequests++;
          const codeKey = String(res.status);
          statusDist[codeKey] = (statusDist[codeKey] || 0) + 1;
        }

        if (latenciesMs.length < MAX_CLIENT_LATENCY_SAMPLES) {
          latenciesMs.push(elapsed);
        } else {
          percentilesApproximate = true;
        }
      } catch {
        totalRequests++;
        failedRequests++;
        statusDist['ERR'] = (statusDist['ERR'] || 0) + 1;
      }

      if (params.signal?.aborted) {
        stoppedEarly = true;
        break;
      }

      if (minDelayBetweenCalls > 0) {
        await new Promise((r) => setTimeout(r, minDelayBetweenCalls));
      }
    }
  };

  try {
    const workerCount = Math.min(params.config.virtualUsers, MAX_VIRTUAL_USERS);
    await Promise.all(Array.from({ length: workerCount }, (_, idx) => worker(idx)));
  } finally {
    clearInterval(samplerTimer);
  }

  if (params.signal?.aborted) {
    stoppedEarly = true;
  }

  const completedAt = Date.now();
  const durationMs = Math.max(1, completedAt - startedAt);
  const summary = buildMetricsSummary({
    latenciesMs,
    totalRequests,
    successfulRequests,
    failedRequests,
    timeoutCount,
    totalBytesReceived,
    durationMs,
    statusCodeDistribution: statusDist,
    percentilesApproximate,
  });

  // Ensure at least one final sample point for charts on fast tests
  if (samples.length === 0) {
    samples.push({
      id: `ps-final-${Date.now()}`,
      runId: params.runId,
      timestamp: completedAt,
      elapsedSeconds: Number((durationMs / 1000).toFixed(2)),
      activeVirtualUsers: params.config.virtualUsers,
      currentRps: summary.requestsPerSecond,
      avgResponseTimeMs: summary.avgResponseTimeMs,
      errorRatePercent: summary.errorRatePercent,
      throughputBytesPerSec: summary.throughputBytesPerSec,
      statusCodes: summary.statusCodeDistribution,
    });
  }

  return {
    run: {
      id: params.runId,
      configId: params.config.id,
      configSnapshot: { ...params.config },
      targetEndpoints,
      status: stoppedEarly ? 'stopped' : 'completed',
      startedAt,
      completedAt,
      durationMs,
      summary,
    },
    samples,
  };
}

export async function cancelPerformanceTest(
  runId: string,
  abortController?: AbortController
): Promise<void> {
  abortController?.abort();
  if (isTauriRuntime()) {
    await invokeDesktop<boolean>('perf_cancel_test', { runId });
  }
}

export function exportPerformanceRunAsJson(
  run: PerformanceTestRun,
  samples: PerformanceMetricSample[]
): string {
  return JSON.stringify({ run, samples }, null, 2);
}

export function exportPerformanceRunAsCsv(samples: PerformanceMetricSample[]): string {
  const header = 'elapsed_seconds,active_virtual_users,current_rps,avg_response_time_ms,error_rate_percent,throughput_bytes_per_sec';
  const rows = samples.map(
    (s) =>
      `${s.elapsedSeconds},${s.activeVirtualUsers},${s.currentRps},${s.avgResponseTimeMs},${s.errorRatePercent},${s.throughputBytesPerSec}`
  );
  return [header, ...rows].join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportPerformanceRunAsHtml(run: PerformanceTestRun): string {
  const s = run.summary;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>API Studio Performance Report - ${escapeHtml(run.configSnapshot.name)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; color: #0f172a; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>Performance Test Report: ${escapeHtml(run.configSnapshot.name)}</h1>
  <p>Mode: <strong>${escapeHtml(run.configSnapshot.mode)}</strong> · Status: <strong>${escapeHtml(run.status)}</strong> · Virtual Users: ${run.configSnapshot.virtualUsers}</p>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Requests</td><td>${s.totalRequests}</td></tr>
    <tr><td>Successful / Failed</td><td>${s.successfulRequests} / ${s.failedRequests} (${s.errorRatePercent}% err)</td></tr>
    <tr><td>Throughput (RPS)</td><td>${s.requestsPerSecond} req/s</td></tr>
    <tr><td>Latency Min / Avg / Max</td><td>${s.minResponseTimeMs} ms / ${s.avgResponseTimeMs} ms / ${s.maxResponseTimeMs} ms</td></tr>
    <tr><td>Percentiles (P50 / P90 / P95 / P99)</td><td>${s.medianResponseTimeMs} / ${s.p90ResponseTimeMs} / ${s.p95ResponseTimeMs} / ${s.p99ResponseTimeMs} ms</td></tr>
  </table>
</body>
</html>`;
}
