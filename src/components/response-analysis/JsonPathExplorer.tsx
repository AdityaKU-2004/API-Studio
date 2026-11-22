import React, { useState, useMemo } from 'react';
import { Filter, Copy, Check, AlertCircle } from 'lucide-react';
import { evaluateJsonPath } from '../../features/response-analysis/jsonPathService';

interface JsonPathExplorerProps {
  rawJsonText: string;
}

const PRESETS = ['$', '$.*', '$..id', '$.data', '$.items[*]'];

export const JsonPathExplorer: React.FC<JsonPathExplorerProps> = ({ rawJsonText }) => {
  const [expression, setExpression] = useState('$');
  const [copiedIdx, setCopiedIdx] = useState<number | 'all' | null>(null);

  const evaluation = useMemo(() => {
    return evaluateJsonPath(rawJsonText, expression);
  }, [rawJsonText, expression]);

  const handleCopy = (text: string, tag: number | 'all') => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(tag);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-slate-800/60 bg-slate-900/40 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="Enter JSONPath expression (e.g. $.users[*].email)"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          {evaluation.valid && evaluation.matches.length > 0 && (
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  JSON.stringify(
                    evaluation.matches.map((m) => m.value),
                    null,
                    2
                  ),
                  'all'
                )
              }
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer shrink-0"
            >
              {copiedIdx === 'all' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy Results ({evaluation.matches.length})</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-slate-500">Examples:</span>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setExpression(p)}
              className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 font-mono text-slate-300 cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {!evaluation.valid && evaluation.error && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{evaluation.error}</span>
          </div>
        )}

        {evaluation.valid && evaluation.matches.length === 0 && (
          <div className="py-10 text-center text-xs text-slate-500">
            No nodes matched JSONPath &ldquo;{expression}&rdquo;.
          </div>
        )}

        {evaluation.valid &&
          evaluation.matches.map((match, idx) => (
            <div
              key={`${match.path}-${idx}`}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-1.5 select-text"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="text-cyan-400 truncate" title={match.path}>
                  {match.path}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      typeof match.value === 'string'
                        ? match.value
                        : JSON.stringify(match.value, null, 2),
                      idx
                    )
                  }
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedIdx === idx ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copy</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-slate-200 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                {typeof match.value === 'string'
                  ? JSON.stringify(match.value)
                  : JSON.stringify(match.value, null, 2)}
              </pre>
            </div>
          ))}
      </div>
    </div>
  );
};
