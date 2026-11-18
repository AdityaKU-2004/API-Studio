import React from 'react';
import { Terminal, Trash2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { ScriptConsoleEntry } from '../../types';

interface ScriptConsoleProps {
  logs: ScriptConsoleEntry[];
  onClear: () => void;
}

export const ScriptConsole: React.FC<ScriptConsoleProps> = ({ logs, onClear }) => {
  return (
    <div className="flex flex-col border-t border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 bg-[#0b0e14]/90 dark:bg-[#0b0e14]/90 light:bg-slate-50/95">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/70 dark:border-slate-800/70 light:border-slate-200 text-[11px]">
        <div className="flex items-center gap-2 font-medium text-slate-300 dark:text-slate-300 light:text-slate-700">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Script Console</span>
          <span className="font-mono text-[10px] text-slate-500">({logs.length})</span>
        </div>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-red-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="max-h-36 overflow-y-auto px-3 py-2 font-mono text-[11px] space-y-1">
        {logs.length === 0 ? (
          <div className="text-slate-500 py-2 text-center">
            No script console output yet. Use console.log() inside pre-request or post-response scripts.
          </div>
        ) : (
          logs.map((entry) => {
            const levelColor =
              entry.level === 'error'
                ? 'text-red-400'
                : entry.level === 'warn'
                ? 'text-amber-400'
                : 'text-slate-300 dark:text-slate-300 light:text-slate-700';

            const LevelIcon =
              entry.level === 'error'
                ? XCircle
                : entry.level === 'warn'
                ? AlertTriangle
                : Info;

            return (
              <div
                key={entry.id}
                className="flex items-start gap-2 py-0.5 border-b border-slate-800/40 dark:border-slate-800/40 light:border-slate-200/60 last:border-b-0"
              >
                <LevelIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${levelColor}`} />
                <span className="text-[10px] text-slate-500 shrink-0 uppercase">
                  [{entry.stage === 'pre-request' ? 'PRE' : 'POST'}]
                </span>
                <span className={`break-all whitespace-pre-wrap flex-1 ${levelColor}`}>
                  {entry.message}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
