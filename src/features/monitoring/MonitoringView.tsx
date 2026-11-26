import React, { useState } from 'react';
import {
  Bell,
  HeartPulse,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  AlertConfig,
  HttpMethod,
  MonitorConfig,
  MonitorProtocolType,
} from '../../types';
import { useMonitoringStore } from '../../stores/monitoringStore';
import {
  computeMonitorSummary,
  MONITORING_RUNTIME_NOTICE,
} from '../../services/monitoring/monitoringService';

export const MonitoringView: React.FC = () => {
  const {
    monitors,
    results,
    alertConfigs,
    alertEvents,
    checkingMonitorIds,
    saveMonitor,
    deleteMonitor,
    toggleMonitorEnabled,
    toggleMonitorPaused,
    runManualCheck,
    clearAlerts,
  } = useMonitoringStore();

  const [selectedId, setSelectedId] = useState<string>(monitors[0]?.id || '');
  const [name, setName] = useState('API Health Probe');
  const [protocol, setProtocol] = useState<MonitorProtocolType>('http');
  const [endpoint, setEndpoint] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [degradedLatencyMs, setDegradedLatencyMs] = useState(800);
  const [expectedStatuses, setExpectedStatuses] = useState('200,201,204');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [desktopNotify, setDesktopNotify] = useState(true);
  const [alertOnFailure, setAlertOnFailure] = useState(true);
  const [alertOnRecovery, setAlertOnRecovery] = useState(true);

  const activeMonitor = monitors.find((m) => m.id === selectedId) || monitors[0] || null;
  const activeResults = activeMonitor
    ? results.filter((r) => r.monitorId === activeMonitor.id).slice(0, 40).reverse()
    : [];
  const activeSummary = activeMonitor
    ? computeMonitorSummary(activeMonitor.id, results)
    : null;

  const handleSaveNewMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    const monId = `mon-${Date.now()}`;
    const statuses = expectedStatuses
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 100);

    const monitor: MonitorConfig = {
      id: monId,
      name: name.trim() || 'API Monitor',
      protocol,
      endpoint: endpoint.trim(),
      method,
      headers: {},
      expectedStatuses: statuses.length > 0 ? statuses : [200],
      timeoutMs: 10000,
      intervalSeconds: Math.max(10, intervalSeconds),
      degradedLatencyMs: Math.max(50, degradedLatencyMs),
      enabled: true,
      paused: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const alertCfg: AlertConfig = {
      id: `alt-${monId}`,
      monitorId: monId,
      name: `${monitor.name} Alert`,
      desktopNotification: desktopNotify,
      inAppNotification: true,
      webhookEnabled: Boolean(webhookUrl.trim()),
      webhookUrl: webhookUrl.trim() || undefined,
      alertOnFailure,
      alertOnRecovery,
      latencyThresholdMs: degradedLatencyMs,
      updatedAt: Date.now(),
    };

    await saveMonitor(monitor, alertCfg);
    setSelectedId(monId);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <HeartPulse className="w-4 h-4 text-emerald-500" />
          <div>
            <h1 className="text-sm font-semibold">API Monitoring &amp; Health Checks</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multi-protocol probes (HTTP, GraphQL, TCP, WebSocket, SSE) with uptime &amp; alert rules.
            </p>
          </div>
        </div>
        {alertEvents.length > 0 && (
          <button
            type="button"
            onClick={clearAlerts}
            className="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{alertEvents.length} Alert(s) · Clear</span>
          </button>
        )}
      </div>

      <div className="px-5 py-2 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-600 dark:text-cyan-300 flex items-center gap-2">
        <Info className="w-4 h-4 shrink-0" />
        <span>{MONITORING_RUNTIME_NOTICE}</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Create & Select Monitors */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] p-4 overflow-y-auto space-y-4 shrink-0 text-xs">
          <form onSubmit={handleSaveNewMonitor} className="space-y-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="font-semibold">Create Monitor</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Monitor name"
              className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as MonitorProtocolType)}
                className="px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="http">HTTP/HTTPS</option>
                <option value="graphql">GraphQL</option>
                <option value="tcp">TCP Socket</option>
                <option value="websocket">WebSocket</option>
                <option value="sse">SSE</option>
              </select>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/health or host:443"
              className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Interval (s)</label>
                <input
                  type="number"
                  min={10}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Degraded (ms)</label>
                <input
                  type="number"
                  min={50}
                  value={degradedLatencyMs}
                  onChange={(e) => setDegradedLatencyMs(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
                />
              </div>
            </div>
            <input
              type="text"
              value={expectedStatuses}
              onChange={(e) => setExpectedStatuses(e.target.value)}
              placeholder="Expected HTTP statuses (200,201)"
              className="w-full px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
            />
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="Optional alert webhook URL"
              className="w-full px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <div className="flex flex-wrap gap-3 text-[11px]">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={desktopNotify} onChange={(e) => setDesktopNotify(e.target.checked)} />
                <span>Desktop</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={alertOnFailure} onChange={(e) => setAlertOnFailure(e.target.checked)} />
                <span>On Failure</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={alertOnRecovery} onChange={(e) => setAlertOnRecovery(e.target.checked)} />
                <span>On Recovery</span>
              </label>
            </div>
            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Monitor</span>
            </button>
          </form>

          <div className="space-y-1.5">
            <div className="font-semibold">Configured Monitors ({monitors.length})</div>
            {monitors.map((m) => {
              const sum = computeMonitorSummary(m.id, results);
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer ${
                    activeMonitor?.id === m.id
                      ? 'border-cyan-500/50 bg-blue-500/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{m.name}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        sum.currentStatus === 'healthy'
                          ? 'text-emerald-500'
                          : sum.currentStatus === 'degraded'
                          ? 'text-amber-500'
                          : sum.currentStatus === 'unavailable'
                          ? 'text-red-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {sum.currentStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                    {m.protocol.toUpperCase()} · {m.endpoint}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active Monitor Telemetry & Logs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!activeMonitor || !activeSummary ? (
            <div className="h-72 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-500">
              <HeartPulse className="w-7 h-7 mb-2 text-slate-400" />
              <div>Create or select a monitor to inspect availability and latency history.</div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{activeMonitor.name}</h2>
                  <p className="text-xs text-slate-500 font-mono">
                    {activeMonitor.protocol.toUpperCase()} · {activeMonitor.endpoint} · Every {activeMonitor.intervalSeconds}s
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    disabled={checkingMonitorIds[activeMonitor.id]}
                    onClick={() => void runManualCheck(activeMonitor.id)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        checkingMonitorIds[activeMonitor.id] ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Check Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void toggleMonitorPaused(activeMonitor.id, !activeMonitor.paused)
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    {activeMonitor.paused ? (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void toggleMonitorEnabled(activeMonitor.id, !activeMonitor.enabled)
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                  >
                    {activeMonitor.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteMonitor(activeMonitor.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                    title="Delete monitor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                  <div className="text-xs text-slate-500">Current State</div>
                  <div className="text-base font-semibold capitalize mt-1">
                    {activeSummary.currentStatus}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                  <div className="text-xs text-slate-500">Availability</div>
                  <div className="text-base font-semibold font-mono tabular-nums mt-1">
                    {activeSummary.availabilityPercent}%
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                  <div className="text-xs text-slate-500">Avg Latency</div>
                  <div className="text-base font-semibold font-mono tabular-nums mt-1">
                    {activeSummary.avgResponseTimeMs} ms
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                  <div className="text-xs text-slate-500">Total Checks</div>
                  <div className="text-base font-semibold font-mono tabular-nums mt-1">
                    {activeSummary.totalChecks} ({activeSummary.failureCount} failed)
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                <h3 className="text-xs font-semibold mb-3">Probe Response Latency (ms)</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeResults}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        labelFormatter={(ts) => new Date(Number(ts)).toLocaleString()}
                      />
                      <Line
                        type="monotone"
                        dataKey="responseTimeMs"
                        name="Latency (ms)"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] text-xs">
                <h3 className="font-semibold mb-2">Recent Health Check Log</h3>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                  {activeResults.slice().reverse().map((r) => (
                    <div key={r.id} className="py-2 flex items-center justify-between gap-2 font-mono tabular-nums">
                      <span>{new Date(r.timestamp).toLocaleTimeString()}</span>
                      <span className="capitalize">{r.status}</span>
                      <span>{r.statusCode ? `HTTP ${r.statusCode}` : 'N/A'}</span>
                      <span>{r.responseTimeMs} ms</span>
                      <span className="text-slate-500 truncate max-w-xs">{r.errorMessage || 'OK'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {alertConfigs.find((a) => a.monitorId === activeMonitor.id) && (
                <div className="text-xs text-slate-500">
                  Alert rule active: notifications dispatch on failure transitions and recovery while the app is open.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
