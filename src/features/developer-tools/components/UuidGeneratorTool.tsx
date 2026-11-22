import React, { useState } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { generateUuidBatch } from '../services/cryptoAndIdTools';
import { useDeveloperToolsStore } from '../../../stores/developerToolsStore';

export const UuidGeneratorTool: React.FC = () => {
  const { preferences, updatePreferences } = useDeveloperToolsStore();
  const [count, setCount] = useState<number>(preferences.uuidDefaultCount || 5);
  const [uuids, setUuids] = useState<string[]>(() => generateUuidBatch(preferences.uuidDefaultCount || 5));
  const [copiedIdx, setCopiedIdx] = useState<number | 'all' | null>(null);

  const handleGenerate = () => {
    setUuids(generateUuidBatch(count));
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Batch Count:</label>
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => {
              const next = Math.max(1, Math.min(200, Number(e.target.value) || 1));
              setCount(next);
              void updatePreferences({ uuidDefaultCount: next });
            }}
            className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50 tabular-nums"
          />
          <button
            type="button"
            onClick={handleGenerate}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate UUID v4 (CSPRNG)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(uuids.join('\n'));
            setCopiedIdx('all');
            setTimeout(() => setCopiedIdx(null), 1500);
          }}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
        >
          {copiedIdx === 'all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>Copy All ({uuids.length})</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/60">
        {uuids.map((id, idx) => (
          <div
            key={`${id}-${idx}`}
            className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-900/40 font-mono text-xs"
          >
            <span className="text-cyan-200 select-text">{id}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(id);
                setCopiedIdx(idx);
                setTimeout(() => setCopiedIdx(null), 1500);
              }}
              className="text-slate-500 hover:text-cyan-300 cursor-pointer"
              title="Copy UUID"
            >
              {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
