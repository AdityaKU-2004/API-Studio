import {
  AlertConfig,
  ApiRequest,
  HealthStatus,
  MonitorCheckResult,
  MonitorConfig,
  MonitorMetricsSummary,
} from '../../types';
import { httpClient } from '../http/httpClient';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from '../desktop/tauriBridge';
import { substituteVariables } from '../variables/variableResolver';
import { createDefaultRequest } from '../../stores/requestStore';

export const MONITORING_RUNTIME_NOTICE =
  'Monitoring checks run only while the API Studio desktop application is open. For unattended 24/7 monitoring, export a CI/CD or CLI health check job.';

export function evaluateMonitorStatus(
  success: boolean,
  responseTimeMs: number,
  degradedLatencyMs: number
): HealthStatus {
  if (!success) return 'unavailable';
  if (degradedLatencyMs > 0 && responseTimeMs > degradedLatencyMs) return 'degraded';
  return 'healthy';
}

export function computeMonitorSummary(
  monitorId: string,
  results: MonitorCheckResult[]
): MonitorMetricsSummary {
  const relevant = results
    .filter((r) => r.monitorId === monitorId)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (relevant.length === 0) {
    return {
      monitorId,
      currentStatus: 'unknown',
      availabilityPercent: 100,
      avgResponseTimeMs: 0,
      totalChecks: 0,
      failureCount: 0,
      consecutiveFailures: 0,
    };
  }

  const totalChecks = relevant.length;
  const successes = relevant.filter((r) => r.success);
  const failures = relevant.filter((r) => !r.success);
  const avgResponseTimeMs = Number(
    (relevant.reduce((acc, r) => acc + r.responseTimeMs, 0) / totalChecks).toFixed(1)
  );
  const availabilityPercent = Number(((successes.length / totalChecks) * 100).toFixed(2));

  let consecutiveFailures = 0;
  for (let i = relevant.length - 1; i >= 0; i--) {
    if (!relevant[i].success) consecutiveFailures++;
    else break;
  }

  const latest = relevant[relevant.length - 1];
  return {
    monitorId,
    currentStatus: latest.status,
    availabilityPercent,
    avgResponseTimeMs,
    lastSuccessAt: successes.length > 0 ? successes[successes.length - 1].timestamp : undefined,
    lastFailureAt: failures.length > 0 ? failures[failures.length - 1].timestamp : undefined,
    totalChecks,
    failureCount: failures.length,
    consecutiveFailures,
  };
}

export async function executeMonitorCheck(
  monitor: MonitorConfig,
  resolvedVariables: Record<string, string>
): Promise<MonitorCheckResult> {
  const endpoint = substituteVariables(monitor.endpoint, resolvedVariables);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(monitor.headers || {})) {
    headers[substituteVariables(k, resolvedVariables)] = substituteVariables(v, resolvedVariables);
  }
  const body = monitor.body ? substituteVariables(monitor.body, resolvedVariables) : undefined;

  if (isTauriRuntime()) {
    return invokeDesktop<MonitorCheckResult>('monitor_run_check', {
      probe: {
        id: monitor.id,
        name: monitor.name,
        protocol: monitor.protocol,
        endpoint,
        method: monitor.method,
        headers,
        body: body ?? null,
        expectedStatuses: monitor.expectedStatuses,
        expectedContentSubstring: monitor.expectedContentSubstring ?? null,
        timeoutMs: monitor.timeoutMs,
        intervalSeconds: monitor.intervalSeconds,
        degradedLatencyMs: monitor.degradedLatencyMs,
      },
    });
  }

  // Browser fallback
  if (monitor.protocol === 'tcp') {
    return {
      id: `mc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      monitorId: monitor.id,
      timestamp: Date.now(),
      status: 'unknown',
      responseTimeMs: 0,
      success: false,
      errorMessage: 'Raw TCP socket probes require the native API Studio Desktop runtime.',
    };
  }

  const startedAt = Date.now();
  if (monitor.protocol === 'websocket') {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(endpoint);
        const timer = setTimeout(() => {
          ws.close();
          resolve({
            id: `mc-${Date.now()}`,
            monitorId: monitor.id,
            timestamp: Date.now(),
            status: 'unavailable',
            responseTimeMs: Date.now() - startedAt,
            success: false,
            errorMessage: 'WebSocket connection probe timed out',
          });
        }, monitor.timeoutMs);

        ws.onopen = () => {
          clearTimeout(timer);
          const elapsed = Date.now() - startedAt;
          ws.close();
          resolve({
            id: `mc-${Date.now()}`,
            monitorId: monitor.id,
            timestamp: Date.now(),
            status: evaluateMonitorStatus(true, elapsed, monitor.degradedLatencyMs),
            responseTimeMs: elapsed,
            success: true,
          });
        };
        ws.onerror = () => {
          clearTimeout(timer);
          resolve({
            id: `mc-${Date.now()}`,
            monitorId: monitor.id,
            timestamp: Date.now(),
            status: 'unavailable',
            responseTimeMs: Date.now() - startedAt,
            success: false,
            errorMessage: 'WebSocket handshake failed',
          });
        };
      } catch (err) {
        resolve({
          id: `mc-${Date.now()}`,
          monitorId: monitor.id,
          timestamp: Date.now(),
          status: 'unavailable',
          responseTimeMs: Date.now() - startedAt,
          success: false,
          errorMessage: err instanceof Error ? err.message : 'WebSocket probe error',
        });
      }
    });
  }

  // HTTP, GraphQL, or SSE probe via httpClient
  const baseReq = createDefaultRequest(monitor.name, monitor.method);
  const req: ApiRequest = {
    ...baseReq,
    id: `mon-${monitor.id}`,
    url: endpoint,
    headers: Object.entries(headers).map(([key, value], idx) => ({
      id: `mh-${idx}`,
      key,
      value,
      description: '',
      enabled: true,
    })),
    bodyType: body ? 'json' : 'none',
    rawBody: body || '',
    settings: {
      ...baseReq.settings,
      timeout: monitor.timeoutMs,
      followRedirects: true,
      sslVerification: true,
      autoEncodeUrl: true,
    },
    updatedAt: Date.now(),
  };

  const res = await httpClient.execute(req, {
    tabId: `monitor-probe-${monitor.id}`,
    resolvedVariables,
    timeoutMs: monitor.timeoutMs,
  });

  const expected =
    monitor.expectedStatuses.length > 0 ? monitor.expectedStatuses : [200, 201, 204];
  const statusMatch = res.status > 0 && expected.includes(res.status);
  const contentMatch = monitor.expectedContentSubstring?.trim()
    ? res.body.includes(monitor.expectedContentSubstring)
    : true;
  const success = !res.error && statusMatch && contentMatch;
  const elapsed = res.timeMs || Date.now() - startedAt;

  return {
    id: `mc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    monitorId: monitor.id,
    timestamp: Date.now(),
    status: evaluateMonitorStatus(success, elapsed, monitor.degradedLatencyMs),
    statusCode: res.status || undefined,
    responseTimeMs: Math.round(elapsed),
    success,
    errorMessage: success
      ? undefined
      : res.error?.message ||
        (!statusMatch
          ? `HTTP status ${res.status} outside expected [${expected.join(', ')}]`
          : 'Expected response content substring missing'),
  };
}

export interface AlertDispatchEvent {
  type: 'failure' | 'recovery' | 'latency';
  monitorName: string;
  message: string;
  timestamp: number;
}

export function evaluateAlertTransition(params: {
  monitor: MonitorConfig;
  previousStatus: HealthStatus;
  result: MonitorCheckResult;
  alertConfig?: AlertConfig;
}): AlertDispatchEvent | null {
  const { monitor, previousStatus, result, alertConfig } = params;
  if (!alertConfig) return null;

  if (!result.success && alertConfig.alertOnFailure) {
    return {
      type: 'failure',
      monitorName: monitor.name,
      message: `${monitor.name} failed (${result.errorMessage || `HTTP ${result.statusCode ?? 0}`})`,
      timestamp: result.timestamp,
    };
  }

  if (
    result.success &&
    previousStatus === 'unavailable' &&
    alertConfig.alertOnRecovery
  ) {
    return {
      type: 'recovery',
      monitorName: monitor.name,
      message: `${monitor.name} recovered (${result.responseTimeMs}ms)`,
      timestamp: result.timestamp,
    };
  }

  if (
    result.success &&
    alertConfig.latencyThresholdMs &&
    result.responseTimeMs > alertConfig.latencyThresholdMs
  ) {
    return {
      type: 'latency',
      monitorName: monitor.name,
      message: `${monitor.name} exceeded latency threshold (${result.responseTimeMs}ms > ${alertConfig.latencyThresholdMs}ms)`,
      timestamp: result.timestamp,
    };
  }

  return null;
}
