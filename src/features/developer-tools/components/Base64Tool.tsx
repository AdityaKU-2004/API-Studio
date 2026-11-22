import React, { useState } from 'react';
import { Copy, Check, ArrowLeftRight } from 'lucide-react';
import { encodeBase64Unicode, decodeBase64Unicode } from '../services/tokenAndCodecTools';

export const Base64Tool: React.FC = () => {
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('Hello API Studio — Unicode ✓ UTF-8!');
  const [copied, setCopied] = useState(false);

  const result =
    direction === 'encode' ? encodeBase64Unicode(input) : decodeBase64Unicode(input);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDirection('encode')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              direction === 'encode'
                ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            UTF-8 → Base64
          </button>
          <button
            type="button"
            onClick={() => setDirection('decode')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              direction === 'decode'
                ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Base64 → UTF-8
          </button>
          <button
            type="button"
            onClick={() => {
              if (result.success) {
                setInput(result.output);
                setDirection(direction === 'encode' ? 'decode' : 'encode');
              }
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            <span>Swap</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!result.success) return;
            navigator.clipboard.writeText(result.output);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          disabled={!result.success}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>Copy Output</span>
        </button>
      </div>

      {!result.success && result.error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {result.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={direction === 'encode' ? 'Enter UTF-8 text...' : 'Enter Base64 or Base64URL string...'}
          spellCheck={false}
          className="h-full min-h-[280px] p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
        />
        <textarea
          readOnly
          value={result.success ? result.output : ''}
          placeholder="Result..."
          className="h-full min-h-[280px] p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 focus:outline-none resize-none select-text"
        />
      </div>
    </div>
  );
};
