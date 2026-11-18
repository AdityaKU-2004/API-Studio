import React from 'react';
import { CheckCircle2, XCircle, Clock, Layers } from 'lucide-react';
import { TestReport } from '../../types';

interface ReportOverviewProps {
  report: TestReport;
}

export const ReportOverview: React.FC<ReportOverviewProps> = ({ report }) => {
  const { summary } = report;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3 p-4 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {report.status === 'passed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <h2 className="text-base font-semibold text-slate-100 dark:text-slate-100 light:text-slate-900">
              {report.name}
            </h2>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
            <span>
              Source: <strong className="text-slate-300 dark:text-slate-300 light:text-slate-700">{report.sourceName}</strong> ({report.sourceType})
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              {report.environmentName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(report.startedAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="text-right font-mono">
          <div
            className={`text-lg font-bold ${
              report.status === 'passed' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {summary.passRate}% Pass Rate
          </div>
          <div className="text-[11px] text-slate-400">
            Total duration: {summary.totalDurationMs}ms · {summary.iterations} iteration{summary.iterations === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
          <div className="text-[10px] uppercase text-slate-400 font-mono">Requests Passed</div>
          <div className="text-lg font-bold font-mono mt-1 text-emerald-400">
            {summary.passedRequests} / {summary.totalRequests}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {summary.failedRequests} failed
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
          <div className="text-[10px] uppercase text-slate-400 font-mono">Assertions Passed</div>
          <div className="text-lg font-bold font-mono mt-1 text-cyan-400">
            {summary.passedAssertions} / {summary.totalAssertions}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {summary.failedAssertions} failed · {summary.skippedAssertions} skipped
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
          <div className="text-[10px] uppercase text-slate-400 font-mono">Avg Response Time</div>
          <div className="text-lg font-bold font-mono mt-1 text-slate-100 dark:text-slate-100 light:text-slate-900">
            {summary.averageResponseTimeMs} ms
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Min {summary.minResponseTimeMs}ms · Max {summary.maxResponseTimeMs}ms
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
          <div className="text-[10px] uppercase text-slate-400 font-mono">Status</div>
          <div
            className={`text-lg font-bold font-mono mt-1 uppercase ${
              report.status === 'passed' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {report.status}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Execution verified
          </div>
        </div>
      </div>
    </div>
  );
};
