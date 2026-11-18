import React from 'react';
import {
  BarChart3,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useReportStore } from '../../stores/reportStore';
import {
  exportReportAsCsv,
  exportReportAsHtml,
  exportReportAsJson,
} from '../../services/testing/testReportService';
import { ReportOverview } from './ReportOverview';
import { ReportCharts } from './ReportCharts';
import { ReportDetails } from './ReportDetails';

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const TestReports: React.FC = () => {
  const {
    reports,
    selectedReportId,
    retentionLimit,
    selectReport,
    deleteReport,
    clearReports,
    setRetentionLimit,
  } = useReportStore();

  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null;

  return (
    <div className="flex flex-col h-full bg-[#11151e] dark:bg-[#11151e] light:bg-white text-slate-200 dark:text-slate-200 light:text-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold">Test Reports & Analytics</h1>
            <p className="text-[11px] text-slate-400">
              Run summaries, latency visualizations, and sanitized exports (JSON / CSV / HTML)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-slate-400">
            <span>Retention:</span>
            <select
              value={retentionLimit}
              onChange={(e) => setRetentionLimit(Number(e.target.value))}
              className="px-2 py-1 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-700 text-xs"
            >
              <option value={25}>25 reports</option>
              <option value={50}>50 reports</option>
              <option value={100}>100 reports</option>
              <option value={200}>200 reports</option>
            </select>
          </label>

          {activeReport && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `${activeReport.id}.json`,
                    exportReportAsJson(activeReport),
                    'application/json'
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-700 hover:text-cyan-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `${activeReport.id}.csv`,
                    exportReportAsCsv(activeReport),
                    'text/csv'
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-700 hover:text-cyan-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `${activeReport.id}.html`,
                    exportReportAsHtml(activeReport),
                    'text/html'
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>HTML</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Report History List */}
        <div className="w-72 border-r border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-slate-800/70 dark:border-slate-800/70 light:border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
            <span>Run History ({reports.length})</span>
            {reports.length > 0 && (
              <button
                type="button"
                onClick={clearReports}
                className="text-red-400 hover:underline cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {reports.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No test reports yet. Run a collection or test suite to generate reports.
              </div>
            ) : (
              reports.map((rpt) => {
                const isSelected = activeReport?.id === rpt.id;
                return (
                  <div
                    key={rpt.id}
                    onClick={() => selectReport(rpt.id)}
                    className={`p-2.5 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/40'
                        : 'border-transparent hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {rpt.status === 'passed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="text-xs font-medium truncate">{rpt.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteReport(rpt.id);
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center justify-between">
                      <span>{rpt.summary.passRate}% pass</span>
                      <span>{rpt.summary.totalRequests} req</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Report Dashboard */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeReport ? (
            <>
              <ReportOverview report={activeReport} />
              <ReportCharts report={activeReport} />
              <ReportDetails report={activeReport} />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 space-y-2">
              <BarChart3 className="w-10 h-10 text-slate-600 stroke-1" />
              <p>Execute a collection or test suite to view interactive test analytics and export reports.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
