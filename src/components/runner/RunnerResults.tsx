import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { useRunnerStore } from '../../stores/runnerStore';
import { useReportStore } from '../../stores/reportStore';
import { useAppStore } from '../../stores/appStore';
import { MethodBadge } from '../common/MethodBadge';

interface RunnerResultsProps {
  onOpenReport?: () => void;
}

export const RunnerResults: React.FC<RunnerResultsProps> = ({ onOpenReport }) => {
  const { results, lastReportId } = useRunnerStore();
  const { selectReport } = useReportStore();
  const { setActiveView } = useAppStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (results.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-lg">
        Start a run above to stream live request outcomes, assertion checks, and iteration logs.
      </div>
    );
  }

  return (
    <div className="space-y-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
          Execution Results ({results.length})
        </span>
        {lastReportId && (
          <button
            type="button"
            onClick={() => {
              selectReport(lastReportId);
              setActiveView('reports');
              onOpenReport?.();
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600/20 border border-blue-500/30 text-cyan-300 hover:bg-blue-600/30 text-xs font-medium cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Open Full Test Report</span>
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {results.map((r) => {
          const isExp = Boolean(expanded[r.id]);
          const passedTests = r.tests.filter((t) => t.status !== 'failed' && t.passed).length;
          const failedTests = r.tests.filter((t) => t.status === 'failed' || !t.passed).length;

          return (
            <div
              key={r.id}
              className={`rounded-md border overflow-hidden ${
                r.passed
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : 'border-red-500/30 bg-red-500/5'
              }`}
            >
              <div
                onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExp ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  {r.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className="font-mono text-[10px] text-slate-400">
                    #{r.iteration}.{r.order}
                  </span>
                  <MethodBadge method={r.method} size="sm" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.requestName}</div>
                    <div className="font-mono text-[10px] text-slate-400 truncate">
                      {r.resolvedUrl}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono text-[11px] shrink-0">
                  <span className={r.status >= 200 && r.status < 400 ? 'text-emerald-400' : 'text-red-400'}>
                    {r.status} {r.statusText}
                  </span>
                  <span className="text-slate-400">{r.responseTimeMs}ms</span>
                  <span className={failedTests > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {passedTests}/{passedTests + failedTests} tests
                  </span>
                </div>
              </div>

              {isExp && (
                <div className="px-8 pb-3 pt-2 border-t border-slate-800/50 space-y-2 text-[11px]">
                  {r.failedReason && (
                    <div className="p-2 rounded bg-red-950/30 border border-red-500/30 text-red-300 font-mono">
                      {r.failedReason}
                    </div>
                  )}

                  {r.tests.length > 0 && (
                    <div className="space-y-1">
                      {r.tests.map((t, i) => (
                        <div key={i} className="flex items-center justify-between font-mono">
                          <span className={t.passed ? 'text-emerald-300' : 'text-red-300'}>
                            {t.passed ? 'PASS' : 'FAIL'} · {t.name}
                            {t.error ? ` — ${t.error}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.consoleLogs.length > 0 && (
                    <div className="p-2 rounded bg-black/30 border border-slate-800 font-mono text-[10px] text-slate-300 space-y-0.5">
                      <div className="text-slate-500 uppercase">Console Output</div>
                      {r.consoleLogs.map((l) => (
                        <div key={l.id}>
                          [{l.stage}] {l.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
