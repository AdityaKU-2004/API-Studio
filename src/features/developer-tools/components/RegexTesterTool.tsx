import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { testRegexSafely } from '../services/curlColorRegexTools';

export const RegexTesterTool: React.FC = () => {
  const [pattern, setPattern] = useState('(?<resource>users|orders)/(\\d+)');
  const [flags, setFlags] = useState('gi');
  const [testText, setTestText] = useState(
    'GET /api/v1/users/42\nPOST /api/v1/orders/1089\nDELETE /api/v1/users/7'
  );

  const toggleFlag = (flag: string) => {
    setFlags((prev) => (prev.includes(flag) ? prev.replace(flag, '') : prev + flag));
  };

  const result = testRegexSafely(pattern, flags, testText);

  return (
    <div className="flex flex-col h-full gap-3 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[240px] flex items-center rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 font-mono text-xs">
          <span className="text-slate-500 mr-1">/</span>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Regular expression pattern..."
            className="flex-1 bg-transparent text-cyan-200 focus:outline-none"
          />
          <span className="text-slate-500 ml-1">/{flags}</span>
        </div>

        <div className="flex items-center gap-1">
          {['g', 'i', 'm', 's', 'u'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => toggleFlag(f)}
              className={`w-7 h-8 rounded-lg font-mono text-xs cursor-pointer ${
                flags.includes(f)
                  ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={`Toggle /${f} flag`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {!result.valid && result.error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{result.error}</span>
        </div>
      )}

      {result.warning && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{result.warning}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Paste sample text (up to 50,000 characters)..."
          spellCheck={false}
          className="h-full min-h-[260px] p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
        />

        <div className="rounded-xl border border-slate-800 bg-slate-950 flex flex-col overflow-hidden min-h-[260px]">
          <div className="px-3.5 py-2 bg-slate-900/70 border-b border-slate-800 text-xs font-semibold text-slate-300">
            Matches ({result.matches.length})
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2">
            {result.matches.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No matches found.</div>
            ) : (
              result.matches.map((m, idx) => (
                <div key={idx} className="p-2.5 space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Match #{idx + 1}</span>
                    <span className="tabular-nums">
                      [{m.index}..{m.endIndex}]
                    </span>
                  </div>
                  <div className="text-emerald-300 break-all">{m.match}</div>
                  {m.groups.length > 0 && (
                    <div className="text-slate-400">
                      Groups: {JSON.stringify(m.groups)}
                    </div>
                  )}
                  {m.namedGroups && Object.keys(m.namedGroups).length > 0 && (
                    <div className="text-cyan-300">
                      Named: {JSON.stringify(m.namedGroups)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
