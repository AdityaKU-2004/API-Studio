import React, { useState } from 'react';
import { Copy, Check, Plus, Trash2 } from 'lucide-react';
import {
  encodeUrlValue,
  decodeUrlValue,
  parseQueryParametersString,
  formatQueryParametersString,
} from '../services/tokenAndCodecTools';

export const UrlCodecTool: React.FC = () => {
  const [action, setAction] = useState<'encode' | 'decode'>('encode');
  const [scope, setScope] = useState<'component' | 'full'>('component');
  const [input, setInput] = useState('https://api.example.com/search?q=hello world&tag=v1/beta');
  const [queryInput, setQueryInput] = useState('https://api.example.com/users?role=admin&active=true');
  const [copied, setCopied] = useState(false);

  const codecResult =
    action === 'encode' ? encodeUrlValue(input, scope) : decodeUrlValue(input, scope);
  const parsedParams = parseQueryParametersString(queryInput);

  const updateParam = (index: number, field: 'key' | 'value', val: string) => {
    const next = parsedParams.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    setQueryInput(formatQueryParametersString(queryInput, next));
  };

  const addParam = () => {
    const next = [...parsedParams, { key: 'param', value: 'value' }];
    setQueryInput(formatQueryParametersString(queryInput, next));
  };

  const removeParam = (index: number) => {
    const next = parsedParams.filter((_, i) => i !== index);
    setQueryInput(formatQueryParametersString(queryInput, next));
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1">
      {/* URL Encoder / Decoder */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAction('encode')}
              className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                action === 'encode'
                  ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40'
                  : 'bg-slate-900 border border-slate-800 text-slate-400'
              }`}
            >
              Encode
            </button>
            <button
              type="button"
              onClick={() => setAction('decode')}
              className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                action === 'decode'
                  ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40'
                  : 'bg-slate-900 border border-slate-800 text-slate-400'
              }`}
            >
              Decode
            </button>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'component' | 'full')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer"
            >
              <option value="component">Component (encodeURIComponent)</option>
              <option value="full">Full URL (encodeURI)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!codecResult.success) return;
              navigator.clipboard.writeText(codecResult.output);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy</span>
          </button>
        </div>

        {!codecResult.success && codecResult.error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {codecResult.error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="h-28 p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
          />
          <textarea
            readOnly
            value={codecResult.success ? codecResult.output : ''}
            className="h-28 p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 focus:outline-none resize-none select-text"
          />
        </div>
      </div>

      {/* Query Parameter Parser & Formatter */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">
            Query Parameter Parser & Builder
          </span>
          <button
            type="button"
            onClick={addParam}
            className="px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/30 text-cyan-300 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Param</span>
          </button>
        </div>

        <input
          type="text"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="https://api.example.com/path?foo=bar"
          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50"
        />

        <div className="space-y-1.5">
          {parsedParams.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">No query parameters found in URL/string.</div>
          ) : (
            parsedParams.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={p.key}
                  onChange={(e) => updateParam(idx, 'key', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                />
                <input
                  type="text"
                  value={p.value}
                  onChange={(e) => updateParam(idx, 'value', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  type="button"
                  onClick={() => removeParam(idx)}
                  className="p-1.5 text-slate-500 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
