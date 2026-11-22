import React, { useState } from 'react';
import { Copy, Check, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { validateAndFormatJson } from '../services/jsonTools';
import { useDeveloperToolsStore } from '../../../stores/developerToolsStore';

export const JsonFormatterTool: React.FC = () => {
  const { preferences, updatePreferences } = useDeveloperToolsStore();
  const [input, setInput] = useState(
    '{"service":"API Studio","version":6,"features":["graphql","websocket","sse"],"active":true}'
  );
  const [indent, setIndent] = useState<number>(preferences.jsonIndentSpaces || 2);
  const [mode, setMode] = useState<'formatted' | 'minified'>('formatted');
  const [copied, setCopied] = useState(false);

  const result = validateAndFormatJson(input, indent);
  const output = result.valid ? (mode === 'formatted' ? result.formatted || '' : result.minified || '') : '';

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('formatted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              mode === 'formatted'
                ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Beautify
          </button>
          <button
            type="button"
            onClick={() => setMode('minified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              mode === 'minified'
                ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Minify
          </button>
          <select
            value={indent}
            onChange={(e) => {
              const next = Number(e.target.value);
              setIndent(next);
              void updatePreferences({ jsonIndentSpaces: next });
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 cursor-pointer focus:outline-none"
          >
            <option value={2}>2 Spaces</option>
            <option value={4}>4 Spaces</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {result.valid ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Valid JSON
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {result.line ? `Line ${result.line}, Col ${result.column}` : 'Invalid JSON'}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!result.valid}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!result.valid}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {!result.valid && result.errorMessage && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-mono">
          {result.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste raw JSON here..."
          spellCheck={false}
          className="h-full min-h-[320px] p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
        />
        <pre className="h-full min-h-[320px] p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 overflow-auto select-text">
          {output || '// Output appears here when JSON is valid'}
        </pre>
      </div>
    </div>
  );
};
