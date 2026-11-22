import React, { useState } from 'react';
import { Clock, Copy, Check } from 'lucide-react';
import { convertTimestampInput } from '../services/cryptoAndIdTools';

export const TimestampTool: React.FC = () => {
  const [input, setInput] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const result = convertTimestampInput(input);

  const copyValue = (key: string, val: string | number | undefined) => {
    if (val === undefined) return;
    navigator.clipboard.writeText(String(val));
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const rows = result.valid
    ? [
        { key: 'unixSeconds', label: 'Unix Timestamp (Seconds)', value: result.unixSeconds },
        { key: 'unixMilliseconds', label: 'Unix Timestamp (Milliseconds)', value: result.unixMilliseconds },
        { key: 'iso8601', label: 'ISO 8601 (UTC)', value: result.iso8601 },
        { key: 'utcString', label: 'RFC 7231 / UTC String', value: result.utcString },
        { key: 'localString', label: 'Local Timezone String', value: result.localString },
        { key: 'relativeDescription', label: 'Relative Offset', value: result.relativeDescription },
      ]
    : [];

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Unix seconds, Unix ms, or ISO 8601 date string..."
          className="flex-1 min-w-[260px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50"
        />
        <button
          type="button"
          onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Now (Unix sec)</span>
        </button>
        <button
          type="button"
          onClick={() => setInput(new Date().toISOString())}
          className="px-3 py-2 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs cursor-pointer"
        >
          Now (ISO 8601)
        </button>
      </div>

      {!result.valid ? (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {result.error}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/70">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-slate-400">{row.label}</span>
              <div className="flex items-center gap-2 font-mono text-slate-200">
                <span className="select-text tabular-nums">{String(row.value)}</span>
                <button
                  type="button"
                  onClick={() => copyValue(row.key, row.value)}
                  className="text-slate-500 hover:text-cyan-300 cursor-pointer"
                >
                  {copiedField === row.key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
