import React from 'react';
import { CheckCircle2, XCircle, Award } from 'lucide-react';
import { TestResult } from '../../types';

interface ResponseTestsProps {
  tests: TestResult[];
}

export const ResponseTests: React.FC<ResponseTestsProps> = ({ tests }) => {
  const passedCount = tests.filter((t) => t.passed).length;
  const totalCount = tests.length;

  return (
    <div className="p-4 space-y-4 text-xs select-none max-w-2xl">
      {/* Summary card */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">Test Execution Summary</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${
              passedCount === totalCount
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {passedCount} / {totalCount} Passed
          </span>
        </div>
      </div>

      {/* Tests list */}
      <div className="space-y-1.5">
        {tests.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            No assertions were executed for this request. Configure post-response tests in the &ldquo;Scripts&rdquo; tab.
          </div>
        ) : (
          tests.map((test, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                test.passed
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200'
                  : 'bg-red-500/5 border-red-500/20 text-red-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {test.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span className="font-medium text-slate-200">{test.name}</span>
              </div>

              <span
                className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                  test.passed
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {test.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
