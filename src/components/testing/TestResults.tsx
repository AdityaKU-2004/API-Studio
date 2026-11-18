import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Award,
} from 'lucide-react';
import { TestResult } from '../../types';

interface TestResultsProps {
  tests: TestResult[];
}

export const TestResults: React.FC<TestResultsProps> = ({ tests }) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const normalized = useMemo(
    () =>
      tests.map((t, idx) => ({
        ...t,
        _id: t.id || `test-${idx}`,
        _status: (t.status || (t.passed ? 'passed' : 'failed')) as 'passed' | 'failed' | 'skipped',
      })),
    [tests]
  );

  const totalCount = normalized.length;
  const passedCount = normalized.filter((t) => t._status === 'passed').length;
  const failedCount = normalized.filter((t) => t._status === 'failed').length;
  const skippedCount = normalized.filter((t) => t._status === 'skipped').length;
  const totalDurationMs = normalized.reduce((acc, t) => acc + (t.durationMs || 0), 0);

  const filtered = useMemo(() => {
    return normalized.filter((t) => {
      if (statusFilter !== 'all' && t._status !== statusFilter) return false;
      if (
        searchQuery.trim() &&
        !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(t.error || t.message || '').toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [normalized, statusFilter, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedIds((s) => ({ ...s, [id]: !s[id] }));
  };

  const handleCopyError = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="p-4 space-y-3 text-xs select-none max-w-4xl">
      {/* Summary Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-lg bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-200">
        <div className="flex items-center gap-2.5">
          <Award className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
            Test Results
          </span>
          <span
            className={`font-mono text-[11px] font-semibold ${
              failedCount === 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {failedCount === 0 ? 'ALL PASSED' : `${failedCount} FAILED`}
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span className="text-slate-300 dark:text-slate-300 light:text-slate-700">
            Total: <strong>{totalCount}</strong>
          </span>
          <span className="text-emerald-400">
            Passed: <strong>{passedCount}</strong>
          </span>
          <span className="text-red-400">
            Failed: <strong>{failedCount}</strong>
          </span>
          <span className="text-slate-400">
            Skipped: <strong>{skippedCount}</strong>
          </span>
          <span className="text-slate-400">{Math.round(totalDurationMs * 100) / 100}ms</span>
        </div>
      </div>

      {/* Filters & Search */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {(['all', 'passed', 'failed', 'skipped'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                  statusFilter === st
                    ? 'bg-blue-600/25 text-cyan-300 dark:text-cyan-300 light:text-blue-700 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search test results..."
              className="w-full pl-8 pr-3 py-1 rounded bg-slate-900/60 dark:bg-slate-900/60 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-300 text-xs focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      )}

      {/* Result Rows */}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            {totalCount === 0
              ? 'No tests or assertions ran for this request. Configure tests in Scripts, Assertions, or Schema tabs.'
              : 'No test results match the current filter.'}
          </div>
        ) : (
          filtered.map((test) => {
            const hasDetails = Boolean(test.error || test.message || test.expected || test.actual);
            const isExpanded = Boolean(expandedIds[test._id]) || test._status === 'failed';
            const errorText = test.error || test.message || '';

            return (
              <div
                key={test._id}
                className={`rounded-md border transition-colors ${
                  test._status === 'passed'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : test._status === 'skipped'
                    ? 'bg-slate-800/30 border-slate-700/40'
                    : 'bg-red-500/5 border-red-500/25'
                }`}
              >
                <div
                  onClick={() => hasDetails && toggleExpand(test._id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 ${
                    hasDetails ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {hasDetails ? (
                      isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}

                    {test._status === 'passed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : test._status === 'skipped' ? (
                      <MinusCircle className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}

                    <span className="font-medium text-slate-200 dark:text-slate-200 light:text-slate-800 truncate">
                      {test.name}
                    </span>

                    {test.source && (
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        [{test.source}]
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono text-[10px]">
                    {test.durationMs !== undefined && (
                      <span className="text-slate-400">{test.durationMs}ms</span>
                    )}
                    <span
                      className={`font-semibold uppercase ${
                        test._status === 'passed'
                          ? 'text-emerald-400'
                          : test._status === 'skipped'
                          ? 'text-slate-400'
                          : 'text-red-400'
                      }`}
                    >
                      {test._status}
                    </span>
                  </div>
                </div>

                {hasDetails && isExpanded && (
                  <div className="px-9 pb-2.5 pt-1 border-t border-slate-800/40 space-y-1.5 text-[11px] font-mono">
                    {errorText && (
                      <div className="flex items-start justify-between gap-2 text-red-300 dark:text-red-300 light:text-red-700">
                        <span className="break-words">{errorText}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyError(
                              test._id,
                              `${test.name}\nError: ${errorText}\nExpected: ${test.expected ?? ''}\nActual: ${test.actual ?? ''}`
                            );
                          }}
                          title="Copy error details"
                          className="p-1 text-slate-400 hover:text-cyan-300 shrink-0 cursor-pointer"
                        >
                          {copiedId === test._id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                    {(test.expected !== undefined || test.actual !== undefined) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {test.expected !== undefined && (
                          <div className="p-1.5 rounded bg-black/25 border border-slate-800/60">
                            <span className="text-slate-400">Expected: </span>
                            <span className="text-emerald-300 break-all">{test.expected}</span>
                          </div>
                        )}
                        {test.actual !== undefined && (
                          <div className="p-1.5 rounded bg-black/25 border border-slate-800/60">
                            <span className="text-slate-400">Actual: </span>
                            <span className="text-amber-300 break-all">{test.actual}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
