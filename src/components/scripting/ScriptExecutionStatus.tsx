import React from 'react';
import { CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { ScriptExecutionResult } from '../../types';

interface ScriptExecutionStatusProps {
  isRunning: boolean;
  result?: ScriptExecutionResult;
}

export const ScriptExecutionStatus: React.FC<ScriptExecutionStatusProps> = ({
  isRunning,
  result,
}) => {
  if (isRunning) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] bg-blue-950/30 border-t border-blue-500/20 text-cyan-300">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Executing inside isolated QuickJS WASM sandbox...</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.error) {
    return (
      <div className="flex items-start justify-between gap-3 px-3 py-2 text-[11px] bg-red-950/30 dark:bg-red-950/30 light:bg-red-50 border-t border-red-500/30 text-red-300 dark:text-red-300 light:text-red-700">
        <div className="flex items-start gap-2 min-w-0">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold uppercase tracking-wide text-[10px]">
              {result.error.type} error
              {result.error.line ? ` · Line ${result.error.line}${result.error.column ? `:${result.error.column}` : ''}` : ''}
            </div>
            <div className="font-mono break-words">{result.error.message}</div>
          </div>
        </div>
        <span className="font-mono text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {result.durationMs}ms
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-[11px] bg-emerald-950/20 dark:bg-emerald-950/20 light:bg-emerald-50 border-t border-emerald-500/20 text-emerald-300 dark:text-emerald-300 light:text-emerald-700">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          Script executed cleanly
          {result.tests.length > 0
            ? ` · ${result.tests.filter((t) => t.passed).length}/${result.tests.length} test(s) passed`
            : ''}
        </span>
      </div>
      <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {result.durationMs}ms
      </span>
    </div>
  );
};
