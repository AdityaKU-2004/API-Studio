import React, { useState } from 'react';
import { Copy, Check, Info } from 'lucide-react';
import { convertJsonToTypeScript } from '../services/jsonTools';
import { useDeveloperToolsStore } from '../../../stores/developerToolsStore';

export const JsonToTsTool: React.FC = () => {
  const { preferences, updatePreferences } = useDeveloperToolsStore();
  const [rootName, setRootName] = useState(preferences.tsRootInterfaceName || 'ApiResponse');
  const [input, setInput] = useState(
    JSON.stringify(
      {
        id: 'usr_42',
        email: 'ada@example.com',
        roles: ['admin', 'editor'],
        profile: { displayName: 'Ada Lovelace', verified: true },
      },
      null,
      2
    )
  );
  const [copied, setCopied] = useState(false);

  const result = convertJsonToTypeScript(input, rootName);

  const handleCopy = () => {
    if (!result.success) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Root Interface:</label>
          <input
            type="text"
            value={rootName}
            onChange={(e) => {
              setRootName(e.target.value);
              void updatePreferences({ tsRootInterfaceName: e.target.value });
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!result.success}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>Copy Interfaces</span>
        </button>
      </div>

      {result.caveats.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <div>{result.caveats.join(' ')}</div>
        </div>
      )}

      {!result.success && result.error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-mono">
          {result.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="h-full min-h-[320px] p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
        />
        <pre className="h-full min-h-[320px] p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-auto select-text">
          {result.success ? result.code : '// Fix invalid JSON input to generate TypeScript interfaces'}
        </pre>
      </div>
    </div>
  );
};
