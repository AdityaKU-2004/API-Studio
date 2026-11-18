import React, { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { TestReport } from '../../types';
import { MethodBadge } from '../common/MethodBadge';

interface ReportDetailsProps {
  report: TestReport;
}

export const ReportDetails: React.FC<ReportDetailsProps> = ({ report }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-2 text-xs">
      <div className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
        Detailed Execution Breakdown ({report.results.length} steps)
      </div>

      <div className="space-y-1.5">
        {report.results.map((r) => {
          const isOpen = Boolean(expanded[r.id]);
          return (
            <div
              key={r.id}
              className="rounded-md border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-white overflow-hidden"
            >
              <div
                onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-800/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? (
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
                    Iter {r.iteration} #{r.order}
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
                  <span className={r.passed ? 'text-emerald-400' : 'text-red-400'}>
                    {r.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="px-9 pb-3 pt-2 border-t border-slate-800/60 space-y-2 text-[11px]">
                  {r.failedReason && (
                    <div className="p-2 rounded bg-red-950/30 border border-red-500/30 text-red-300 font-mono">
                      {r.failedReason}
                    </div>
                  )}

                  {r.tests.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-slate-400 font-semibold">
                        Assertions & Tests
                      </div>
                      {r.tests.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between font-mono py-0.5"
                        >
                          <span
                            className={
                              t.status === 'skipped'
                                ? 'text-slate-400'
                                : t.passed
                                ? 'text-emerald-300'
                                : 'text-red-300'
                            }
                          >
                            [{t.status?.toUpperCase() || (t.passed ? 'PASS' : 'FAIL')}] {t.name}
                            {t.error ? ` — ${t.error}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.consoleLogs.length > 0 && (
                    <div className="p-2 rounded bg-black/30 border border-slate-800 font-mono text-[10px] text-slate-300 space-y-0.5">
                      <div className="text-slate-500 uppercase">Script Console Logs</div>
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
