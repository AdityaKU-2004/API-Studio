import React, { useEffect, useState } from 'react';
import { BarChart2, Download, RefreshCw, Trash2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { UnifiedReportItem } from '../../types';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { exportUnifiedReport } from '../../services/analytics/analyticsService';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

export const AnalyticsCenterView: React.FC = () => {
  const { currentSnapshot, unifiedReports, refreshAnalytics, deleteReportItem } =
    useAnalyticsStore();
  const [kindFilter, setKindFilter] = useState<UnifiedReportItem['kind'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [deleteTarget, setDeleteTarget] = useState<UnifiedReportItem | null>(null);

  useEffect(() => {
    void refreshAnalytics();
  }, [refreshAnalytics]);

  const filteredReports = unifiedReports
    .filter((r) => (kindFilter === 'all' ? true : r.kind === kindFilter))
    .filter(
      (r) =>
        !searchQuery.trim() ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.summary.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) =>
      sortBy === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );

  const chartData = currentSnapshot
    ? [
        { name: 'Test Pass %', value: currentSnapshot.testPassRatePercent },
        { name: 'Contract Pass %', value: currentSnapshot.contractPassRatePercent },
        { name: 'Availability %', value: currentSnapshot.apiAvailabilityPercent },
      ]
    : [];

  const handleDownload = (
    item: UnifiedReportItem,
    format: 'json' | 'csv' | 'html' | 'junit-xml'
  ) => {
    const content = exportUnifiedReport(item, format);
    const ext = format === 'junit-xml' ? 'xml' : format;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.kind}-${item.id}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BarChart2 className="w-4 h-4 text-blue-500" />
          <div>
            <h1 className="text-sm font-semibold">Unified Analytics Dashboard &amp; Report Center</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aggregated reliability, testing, contract, security, performance &amp; workflow telemetry.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshAnalytics()}
          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {currentSnapshot && (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              ['Total Requests', currentSnapshot.totalRequestsExecuted],
              ['Avg Latency', `${currentSnapshot.avgResponseTimeMs} ms`],
              ['Availability', `${currentSnapshot.apiAvailabilityPercent}%`],
              ['Test Pass Rate', `${currentSnapshot.testPassRatePercent}%`],
              ['Contract Pass Rate', `${currentSnapshot.contractPassRatePercent}%`],
              ['Open Sec Findings', currentSnapshot.openSecurityFindings],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]"
              >
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-lg font-semibold font-mono tabular-nums mt-1">{val}</div>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
          <h2 className="text-xs font-semibold mb-3">Reliability &amp; Quality Benchmark (%)</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Report Center */}
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Report Center ({filteredReports.length})</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
              <select
                value={kindFilter}
                onChange={(e) =>
                  setKindFilter(e.target.value as UnifiedReportItem['kind'] | 'all')
                }
                className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="all">All Categories</option>
                <option value="test">Test Runs</option>
                <option value="contract">Contract Reports</option>
                <option value="performance">Performance Benchmarks</option>
                <option value="security">Security Audits</option>
                <option value="monitoring">Monitoring Logs</option>
                <option value="workflow">Workflow Executions</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              No execution reports available yet. Run tests, audits, performance runs, or workflows to generate reports.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredReports.map((rep) => (
                <div key={rep.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{rep.title}</div>
                    <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                      {rep.kind} · {rep.status} · {new Date(rep.timestamp).toLocaleString()} ·{' '}
                      {rep.summary}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['json', 'csv', 'html', 'junit-xml'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleDownload(rep, fmt)}
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span className="uppercase">{fmt === 'junit-xml' ? 'XML' : fmt}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(rep)}
                      className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                      title="Delete report"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void deleteReportItem(deleteTarget);
            setDeleteTarget(null);
          }
        }}
        title="Delete Report Entry"
        message={`Delete "${deleteTarget?.title || ''}" permanently from local storage?`}
      />
    </div>
  );
};
