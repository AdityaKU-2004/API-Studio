import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { parseAndConvertColor } from '../services/curlColorRegexTools';

export const ColorConverterTool: React.FC = () => {
  const [input, setInput] = useState('#38BDF8');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const result = parseAndConvertColor(input);

  const formats = result.valid
    ? [
        { key: 'hex', label: 'HEX', value: result.hex },
        { key: 'hexAlpha', label: 'HEX (8-digit)', value: result.hexAlpha },
        { key: 'rgb', label: 'RGB', value: result.rgb },
        { key: 'rgba', label: 'RGBA', value: result.rgba },
        { key: 'hsl', label: 'HSL', value: result.hsl },
        { key: 'hsla', label: 'HSLA', value: result.hsla },
      ]
    : [];

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          value={result.valid && result.hex ? result.hex : '#38bdf8'}
          onChange={(e) => setInput(e.target.value)}
          className="w-11 h-10 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="#38BDF8, rgb(56, 189, 248), or hsl(198, 93%, 60%)"
          className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      {!result.valid ? (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {result.error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col items-center justify-center gap-3">
            <div
              className="w-full h-32 rounded-lg border border-slate-700/60"
              style={{ backgroundColor: result.rgba }}
            />
            <div className="text-xs font-mono text-slate-300">
              R:{result.r} · G:{result.g} · B:{result.b} · A:{result.a}
            </div>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/70">
            {formats.map((f) => (
              <div key={f.key} className="flex items-center justify-between px-4 py-3 text-xs">
                <span className="text-slate-400">{f.label}</span>
                <div className="flex items-center gap-2 font-mono text-slate-200">
                  <span className="select-text">{f.value}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!f.value) return;
                      navigator.clipboard.writeText(f.value);
                      setCopiedKey(f.key);
                      setTimeout(() => setCopiedKey(null), 1500);
                    }}
                    className="text-slate-500 hover:text-cyan-300 cursor-pointer"
                  >
                    {copiedKey === f.key ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
