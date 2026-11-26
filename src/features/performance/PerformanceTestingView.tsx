import React, { useMemo, useState } from 'react';
import {
  Activity,
  Download,
  Play,
  Square,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ApiRequest,
  CollectionItem,
  LoadTestMode,
  PerformanceTestConfig,
} from '../../types';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePerformanceStore } from '../../stores/performanceStore';
import {
  exportPerformanceRunAsCsv,
  exportPerformanceRunAsHtml,
  exportPerformanceRunAsJson,
  getModePreset,
  MAX_DURATION_SECONDS,
  MAX_RPS,
  MAX_VIRTUAL_USERS,
} from '../../services/performance/performanceEngine';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

function flattenCollectionRequests(items: CollectionItem[]): ApiRequest[] {
  const out: ApiRequest[] = [];
  for (const it of items) {
    if (it.type === 'request' && it.request) out.push(it.request);
    if (it.children) out.push(...flattenCollectionRequests(it.children));
  }
  return out;
}

export const PerformanceTestingView: React.FC = () => {
  const { collections } = useCollectionStore();
  const {
    runs,
    samplesByRun,
    liveSamples,
    activeRunId,
    isRunning,
    error,
    selectRun,
    deleteRun,
    saveConfig,
    startRun,
    stopActiveRun,
  } = usePerformanceStore();

  const allRequests = useMemo(() => flattenCollectionRequests(collections), [collections]);

  const [name, setName] = useState('API Load Benchmark');
  const [mode, setMode] = useState<LoadTestMode>('load');
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>(() =>
    allRequests.slice(0, 1).map((r) => r.id)
  );
  const [virtualUsers, setVirtualUsers] = useState(10);
  const [durationSeconds, setDurationSeconds] = useState(15);
  const [rampUpSeconds, setRampUpSeconds] = useState(3);
  const [requestDelayMs, setRequestDelayMs] = useState(50);
  const [maxRps, setMaxRps] = useState(100);
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [errorThresholdPercent, setErrorThresholdPercent] = useState(5);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeRun = runs.find((r) => r.id === activeRunId) || runs[0] || null;
  const chartSamples = isRunning
    ? liveSamples
    : (activeRun ? samplesByRun[activeRun.id] : []) || [];

  const handleModeChange = (nextMode: LoadTestMode) => {
    setMode(nextMode);
    const preset = getModePreset(nextMode);
    if (preset.virtualUsers !== undefined) setVirtualUsers(preset.virtualUsers);
    if (preset.durationSeconds !== undefined) setDurationSeconds(preset.durationSeconds);
    if (preset.rampUpSeconds !== undefined) setRampUpSeconds(preset.rampUpSeconds);
    if (preset.maxRequestsPerSecond !== undefined) setMaxRps(preset.maxRequestsPerSecond);
  };

  const toggleRequestSelection = (id: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirmExecute = async () => {
    setConfirmOpen(false);
    const targets = allRequests.filter((r) => selectedRequestIds.includes(r.id));
    const config: PerformanceTestConfig = {
      id: `pconf-${Date.now()}`,
      name: name.trim() || 'Load Test',
      requestIds: targets.map((t) => t.id),
      mode,
      virtualUsers: Math.min(MAX_VIRTUAL_USERS, Math.max(1, virtualUsers)),
      durationSeconds: Math.min(MAX_DURATION_SECONDS, Math.max(1, durationSeconds)),
      rampUpSeconds: Math.max(0, rampUpSeconds),
      rampDownSeconds: 0,
      requestDelayMs: Math.max(0, requestDelayMs),
      maxRequestsPerSecond: Math.min(MAX_RPS, Math.max(1, maxRps)),
      timeoutMs: Math.max(500, timeoutMs),
      errorThresholdPercent,
      confirmedExecution: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveConfig(config);
    await startRun(config, targets);
  };

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-cyan-500" />
          <div>
            <h1 className="text-sm font-semibold">Performance &amp; Load Testing</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bounded concurrency load profiles (max {MAX_VIRTUAL_USERS} VUs, {MAX_RPS} RPS cap) with percentile telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={() => void stopActiveRun()}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Test</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={selectedRequestIds.length === 0}
              onClick={() => setConfirmOpen(true)}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Load Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Config & History Rail */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] overflow-y-auto p-4 space-y-4 shrink-0">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Test Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Load Mode
            </label>
            <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {(['smoke', 'load', 'stress', 'spike', 'soak'] as LoadTestMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeChange(m)}
                  className={`py-1 rounded text-[11px] font-medium capitalize cursor-pointer transition-colors ${
                    mode === m
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Virtual Users (1–{MAX_VIRTUAL_USERS})
              </label>
              <input
                type="number"
                min={1}
                max={MAX_VIRTUAL_USERS}
                value={virtualUsers}
                onChange={(e) => setVirtualUsers(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Duration (s)
              </label>
              <input
                type="number"
                min={1}
                max={MAX_DURATION_SECONDS}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Max RPS Cap
              </label>
              <input
                type="number"
                min={1}
                max={MAX_RPS}
                value={maxRps}
                onChange={(e) => setMaxRps(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Ramp-Up (s)
              </label>
              <input
                type="number"
                min={0}
                max={300}
                value={rampUpSeconds}
                onChange={(e) => setRampUpSeconds(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Delay (ms)
              </label>
              <input
                type="number"
                min={0}
                max={5000}
                value={requestDelayMs}
                onChange={(e) => setRequestDelayMs(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                min={500}
                max={120000}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Target Requests ({selectedRequestIds.length} selected)
            </label>
            <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
              {allRequests.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">Save requests in Collections first.</p>
              ) : (
                allRequests.map((req) => (
                  <label
                    key={req.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(req.id)}
                      onChange={() => toggleRequestSelection(req.id)}
                    />
                    <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400 w-11 shrink-0">
                      {req.method}
                    </span>
                    <span className="truncate">{req.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Recent Test Runs ({runs.length})
            </div>
            <div className="space-y-1.5">
              {runs.map((r) => (
                <div
                  key={r.id}
                  onClick={() => selectRun(r.id)}
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                    activeRun?.id === r.id
                      ? 'border-cyan-500/50 bg-blue-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.configSnapshot.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {r.configSnapshot.mode} · {r.summary.requestsPerSecond} RPS · {r.summary.errorRatePercent}% err
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteRun(r.id);
                    }}
                    className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                    title="Delete run"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Telemetry & Percentile Viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!activeRun && !isRunning ? (
            <div className="h-72 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-center p-6">
              <Activity className="w-8 h-8 text-slate-400 mb-2" />
              <h2 className="text-sm font-medium">No Performance Runs Yet</h2>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Select target requests and concurrency parameters on the left, then start a controlled benchmark.
              </p>
            </div>
          ) : (
            <>
              {activeRun && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">{activeRun.configSnapshot.name}</h2>
                      <p className="text-xs text-slate-500 tabular-nums">
                        Mode: {activeRun.configSnapshot.mode} · Status: {activeRun.status} · Samples: {activeRun.summary.sampleCount}
                        {activeRun.summary.percentilesApproximate ? ' (Approximate - sample capped)' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(
                            exportPerformanceRunAsJson(activeRun, chartSamples),
                            `perf-${activeRun.id}.json`,
                            'application/json'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(
                            exportPerformanceRunAsCsv(chartSamples),
                            `perf-${activeRun.id}.csv`,
                            'text/csv'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(
                            exportPerformanceRunAsHtml(activeRun),
                            `perf-${activeRun.id}.html`,
                            'text/html'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>HTML</span>
                      </button>
                    </div>
                  </div>

                  {/* KPI Summary Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                      <div className="text-xs text-slate-500">Total Requests</div>
                      <div className="text-lg font-semibold font-mono tabular-nums mt-1">
                        {activeRun.summary.totalRequests}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {activeRun.summary.successfulRequests} ok · {activeRun.summary.failedRequests} failed
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                      <div className="text-xs text-slate-500">Throughput</div>
                      <div className="text-lg font-semibold font-mono tabular-nums mt-1">
                        {activeRun.summary.requestsPerSecond} RPS
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {(activeRun.summary.throughputBytesPerSec / 1024).toFixed(1)} KB/s
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                      <div className="text-xs text-slate-500">Latency P95 / P99</div>
                      <div className="text-lg font-semibold font-mono tabular-nums mt-1">
                        {activeRun.summary.p95ResponseTimeMs} / {activeRun.summary.p99ResponseTimeMs} ms
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        Avg {activeRun.summary.avgResponseTimeMs} ms · Med {activeRun.summary.medianResponseTimeMs} ms
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                      <div className="text-xs text-slate-500">Error Rate</div>
                      <div
                        className={`text-lg font-semibold font-mono tabular-nums mt-1 ${
                          activeRun.summary.errorRatePercent > errorThresholdPercent
                            ? 'text-red-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        {activeRun.summary.errorRatePercent}%
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        Timeouts: {activeRun.summary.timeoutCount}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Live / Completed Charts */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                <h3 className="text-xs font-semibold mb-3">Response Time (ms) &amp; RPS Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartSamples}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      <XAxis dataKey="elapsedSeconds" unit="s" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="avgResponseTimeMs"
                        name="Avg Latency (ms)"
                        stroke="#06b6d4"
                        fill="#06b6d4"
                        fillOpacity={0.18}
                      />
                      <Area
                        type="monotone"
                        dataKey="currentRps"
                        name="Current RPS"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.14}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {activeRun && (
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                  <h3 className="text-xs font-semibold mb-3">Latency Percentile &amp; Status Distribution</h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono tabular-nums">
                    <div>Min: {activeRun.summary.minResponseTimeMs}ms</div>
                    <div>Median: {activeRun.summary.medianResponseTimeMs}ms</div>
                    <div>P90: {activeRun.summary.p90ResponseTimeMs}ms</div>
                    <div>P95: {activeRun.summary.p95ResponseTimeMs}ms</div>
                    <div>P99: {activeRun.summary.p99ResponseTimeMs}ms</div>
                    <div>Max: {activeRun.summary.maxResponseTimeMs}ms</div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 text-xs font-mono tabular-nums">
                    {Object.entries(activeRun.summary.statusCodeDistribution).map(([code, count]) => (
                      <span key={code}>
                        HTTP {code}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmExecute()}
        title="Confirm Load Test Execution"
        message={`Start a ${mode} test with ${virtualUsers} virtual users for ${durationSeconds}s (max ${maxRps} RPS) against ${selectedRequestIds.length} endpoint(s)? Only run load tests against systems you own or are authorized to test.`}
      />
    </div>
  );
};
