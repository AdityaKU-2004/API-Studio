import React, { useMemo, useState } from 'react';
import { Eye, Download, Shield } from 'lucide-react';
import { ObservabilityErrorCategory } from '../../types';
import { useObservabilityStore } from '../../stores/observabilityStore';
import {
  aggregateErrorAnalytics,
  exportTracesAsJson,
} from '../../services/observability/observabilityService';

export const ObservabilityView: React.FC = () => {
  const {
    redactionConfig,
    selectedTraceId,
    hostFilter,
    statusFilter,
    errorCategoryFilter,
    setRedactionConfig,
    selectTrace,
    setHostFilter,
    setStatusFilter,
    setErrorCategoryFilter,
    getTraces,
  } = useObservabilityStore();

  const traces = getTraces();
  const errorGroups = useMemo(() => aggregateErrorAnalytics(traces), [traces]);
  const selectedTrace = traces.find((t) => t.id === selectedTraceId) || traces[0] || null;
  const [redactInput, setRedactInput] = useState(redactionConfig.redactHeaders.join(', '));
  const [jsonKeyInput, setJsonKeyInput] = useState(redactionConfig.redactJsonKeys.join(', '));

  const avgDuration =
    traces.length > 0
      ? Math.round(traces.reduce((acc, t) => acc + t.durationMs, 0) / traces.length)
      : 0;
  const errorCount = traces.filter((t) => t.errorCategory !== 'none').length;

  const handleApplyRedaction = () => {
    setRedactionConfig({
      redactHeaders: redactInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      redactJsonKeys: jsonKeyInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  const handleExport = () => {
    const content = exportTracesAsJson(traces, redactionConfig);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-studio-traces-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-cyan-500" />
          <div>
            <h1 className="text-sm font-semibold">API Observability &amp; Trace Correlation</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect request traces, W3C traceparent / correlation IDs, Phase 7 network timings, error analytics &amp; redaction.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Redacted Traces</span>
        </button>
      </div>

      {/* Filters & KPI Strip */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={hostFilter}
            onChange={(e) => setHostFilter(e.target.value)}
            placeholder="Filter by host..."
            className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 w-44"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="2xx">2xx Success</option>
            <option value="4xx">4xx Client Errors</option>
            <option value="5xx">5xx Server Errors</option>
            <option value="error">Failures Only</option>
          </select>
          <select
            value={errorCategoryFilter}
            onChange={(e) =>
              setErrorCategoryFilter(e.target.value as ObservabilityErrorCategory | 'all')
            }
            className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
          >
            <option value="all">All Error Categories</option>
            <option value="timeout">Timeouts</option>
            <option value="network">Network</option>
            <option value="tls">TLS/SSL</option>
            <option value="dns">DNS</option>
            <option value="authentication">Authentication</option>
            <option value="http-status">HTTP Status</option>
            <option value="application">Server 5xx</option>
          </select>
        </div>

        <div className="flex items-center gap-4 font-mono tabular-nums text-slate-500">
          <span>Traces: {traces.length}</span>
          <span>Errors: {errorCount}</span>
          <span>Avg Latency: {avgDuration}ms</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Trace List */}
        <div className="w-1/2 border-r border-slate-200 dark:border-slate-800 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
          {traces.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Execute HTTP requests to inspect request traces and timing correlations.
            </div>
          ) : (
            traces.map((tr) => (
              <div
                key={tr.id}
                onClick={() => selectTrace(tr.id)}
                className={`p-3.5 cursor-pointer text-xs ${
                  selectedTrace?.id === tr.id
                    ? 'bg-blue-500/10'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-semibold text-cyan-500">{tr.method}</span>
                    <span className="truncate font-mono">{tr.url}</span>
                  </div>
                  <span
                    className={`font-mono tabular-nums shrink-0 ${
                      tr.statusCode >= 400 || tr.statusCode === 0 ? 'text-red-500' : 'text-emerald-500'
                    }`}
                  >
                    {tr.statusCode || 'ERR'} · {tr.durationMs}ms
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>{tr.host}</span>
                  <span>·</span>
                  <span>
                    {tr.correlation.transmittedHeadersPresent
                      ? 'Trace ID transmitted'
                      : 'Local tracking ID'}
                  </span>
                  {tr.errorCategory !== 'none' && (
                    <>
                      <span>·</span>
                      <span className="text-red-500">{tr.errorCategory}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Detail & Redaction Rules */}
        <div className="w-1/2 overflow-y-auto p-5 space-y-5 text-xs">
          {selectedTrace && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-2">
                <h2 className="font-semibold text-sm">Trace Correlation Details</h2>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>Local Tracking ID: {selectedTrace.correlation.localTrackingId}</div>
                  <div>traceparent: {selectedTrace.correlation.traceparent || 'Not sent'}</div>
                  <div>X-Request-ID: {selectedTrace.correlation.xRequestId || 'Not sent'}</div>
                  <div>X-Correlation-ID: {selectedTrace.correlation.xCorrelationId || 'Not sent'}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-2">
                <h3 className="font-semibold">Phase Timing Attribution</h3>
                <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-[11px]">
                  <div>DNS: {selectedTrace.dnsMs ?? 'N/A'}ms</div>
                  <div>TCP: {selectedTrace.tcpMs ?? 'N/A'}ms</div>
                  <div>TLS: {selectedTrace.tlsMs ?? 'N/A'}ms</div>
                  <div>TTFB: {selectedTrace.ttfbMs ?? 'N/A'}ms</div>
                  <div>Download: {selectedTrace.downloadMs ?? 'N/A'}ms</div>
                  <div>Total: {selectedTrace.durationMs}ms</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-2">
                <h3 className="font-semibold">Redacted Request &amp; Response Headers</h3>
                <pre className="p-2.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(
                    {
                      requestHeaders: selectedTrace.redactedRequestHeaders,
                      responseHeaders: selectedTrace.redactedResponseHeaders,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}

          {errorGroups.length > 0 && (
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
              <h3 className="font-semibold mb-2">Error Analytics by Category</h3>
              <div className="space-y-1.5">
                {errorGroups.map((g) => (
                  <div key={g.category} className="flex items-center justify-between font-mono tabular-nums">
                    <span>{g.category}</span>
                    <span>
                      {g.count} ({g.sampleHosts.slice(0, 2).join(', ')})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-2.5">
            <div className="flex items-center gap-2 font-semibold">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Sensitive Header &amp; JSON Redaction Rules</span>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Redacted Header Keys</label>
              <input
                type="text"
                value={redactInput}
                onChange={(e) => setRedactInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Redacted JSON Keys</label>
              <input
                type="text"
                value={jsonKeyInput}
                onChange={(e) => setJsonKeyInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyRedaction}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium cursor-pointer"
            >
              Apply Redaction Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
