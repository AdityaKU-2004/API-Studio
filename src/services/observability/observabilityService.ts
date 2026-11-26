import {
  HistoryItem,
  ObservabilityErrorCategory,
  RedactionConfig,
  RequestTraceEntry,
  TraceCorrelationIds,
} from '../../types';

export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  redactHeaders: [
    'authorization',
    'proxy-authorization',
    'x-api-key',
    'cookie',
    'set-cookie',
    'x-auth-token',
  ],
  redactJsonKeys: ['password', 'secret', 'token', 'access_token', 'refresh_token', 'apiKey'],
  maskStyle: 'partial',
};

export function maskSecretValue(value: string, style: 'partial' | 'full'): string {
  if (!value) return '';
  if (style === 'full' || value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function applyHeaderRedaction(
  headers: Record<string, string>,
  config: RedactionConfig
): Record<string, string> {
  const redactSet = new Set(config.redactHeaders.map((h) => h.toLowerCase().trim()));
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers || {})) {
    if (redactSet.has(key.toLowerCase().trim())) {
      out[key] = maskSecretValue(val, config.maskStyle);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export function redactJsonPayload(rawBody: string, config: RedactionConfig): string {
  if (!rawBody.trim()) return rawBody;
  const redactKeys = new Set(config.redactJsonKeys.map((k) => k.toLowerCase().trim()));
  try {
    const parsed = JSON.parse(rawBody);
    const walk = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(walk);
      if (node && typeof node === 'object') {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (redactKeys.has(k.toLowerCase())) {
            result[k] = typeof v === 'string' ? maskSecretValue(v, config.maskStyle) : '[REDACTED]';
          } else {
            result[k] = walk(v);
          }
        }
        return result;
      }
      return node;
    };
    return JSON.stringify(walk(parsed), null, 2);
  } catch {
    return rawBody;
  }
}

export function classifyErrorCategory(
  statusCode: number,
  errorMessage?: string,
  errorType?: string
): ObservabilityErrorCategory {
  const msg = (errorMessage || '').toLowerCase();
  if (errorType === 'timeout' || msg.includes('timed out') || msg.includes('timeout')) {
    return 'timeout';
  }
  if (msg.includes('dns') || msg.includes('enotfound') || msg.includes('failed to lookup')) {
    return 'dns';
  }
  if (msg.includes('tls') || msg.includes('ssl') || msg.includes('certificate')) {
    return 'tls';
  }
  if (statusCode === 401 || statusCode === 403) {
    return 'authentication';
  }
  if (statusCode >= 500) {
    return 'application';
  }
  if (statusCode >= 400) {
    return 'http-status';
  }
  if (errorType === 'network' || (statusCode === 0 && msg.length > 0)) {
    return 'network';
  }
  return 'none';
}

export function extractTraceCorrelation(
  reqHeaders: Record<string, string>,
  resHeaders: Record<string, string>,
  entryId: string
): TraceCorrelationIds {
  const findHeader = (hdrs: Record<string, string>, target: string): string | undefined => {
    const found = Object.entries(hdrs).find(
      ([k]) => k.toLowerCase() === target.toLowerCase()
    );
    return found?.[1];
  };

  const traceparent =
    findHeader(resHeaders, 'traceparent') || findHeader(reqHeaders, 'traceparent');
  const tracestate =
    findHeader(resHeaders, 'tracestate') || findHeader(reqHeaders, 'tracestate');
  const xRequestId =
    findHeader(resHeaders, 'x-request-id') || findHeader(reqHeaders, 'x-request-id');
  const xCorrelationId =
    findHeader(resHeaders, 'x-correlation-id') || findHeader(reqHeaders, 'x-correlation-id');

  const transmittedHeadersPresent = Boolean(
    traceparent || tracestate || xRequestId || xCorrelationId
  );

  return {
    traceparent,
    tracestate,
    xRequestId,
    xCorrelationId,
    localTrackingId: `local-${entryId}`,
    transmittedHeadersPresent,
  };
}

export function buildTraceFromHistoryEntry(
  entry: HistoryItem,
  collectionName: string | undefined,
  environmentName: string | undefined,
  redactionConfig: RedactionConfig
): RequestTraceEntry {
  let host = 'unknown';
  try {
    host = new URL(entry.url).host || 'unknown';
  } catch {
    host = entry.url.split('/')[2] || 'unknown';
  }

  const reqHeaders: Record<string, string> = {};
  for (const h of entry.request?.headers || []) {
    if (h.enabled && h.key) reqHeaders[h.key] = h.value;
  }
  const resHeaders = entry.responseHeaders || {};

  const errorCategory = classifyErrorCategory(
    entry.status,
    entry.errorSummary,
    entry.executionResult === 'error' ? 'network' : undefined
  );

  return {
    id: `tr-${entry.id}`,
    requestId: entry.request?.id || entry.id,
    collectionName,
    environmentName,
    host,
    method: entry.method,
    url: entry.url,
    statusCode: entry.status,
    responseSizeBytes: entry.sizeBytes || 0,
    startTime: entry.timestamp,
    durationMs: entry.timeMs,
    dnsMs: null,
    tcpMs: null,
    tlsMs: null,
    ttfbMs: undefined,
    downloadMs: undefined,
    errorCategory,
    errorDetails: entry.errorSummary,
    correlation: extractTraceCorrelation(reqHeaders, resHeaders, entry.id),
    redactedRequestHeaders: applyHeaderRedaction(reqHeaders, redactionConfig),
    redactedResponseHeaders: applyHeaderRedaction(resHeaders, redactionConfig),
  };
}

export function aggregateErrorAnalytics(
  traces: RequestTraceEntry[]
): Array<{ category: ObservabilityErrorCategory; count: number; sampleHosts: string[] }> {
  const map = new Map<ObservabilityErrorCategory, { count: number; hosts: Set<string> }>();
  for (const tr of traces) {
    if (tr.errorCategory === 'none') continue;
    const cur = map.get(tr.errorCategory) || { count: 0, hosts: new Set<string>() };
    cur.count++;
    cur.hosts.add(tr.host);
    map.set(tr.errorCategory, cur);
  }
  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      sampleHosts: Array.from(data.hosts),
    }))
    .sort((a, b) => b.count - a.count);
}

export function exportTracesAsJson(
  traces: RequestTraceEntry[],
  redactionConfig: RedactionConfig
): string {
  const scrubbed = traces.map((t) => ({
    ...t,
    redactedRequestHeaders: applyHeaderRedaction(t.redactedRequestHeaders, redactionConfig),
    redactedResponseHeaders: applyHeaderRedaction(t.redactedResponseHeaders, redactionConfig),
  }));
  return JSON.stringify(scrubbed, null, 2);
}
