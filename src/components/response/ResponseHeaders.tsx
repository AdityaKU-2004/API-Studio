import React, { useState, useMemo } from 'react';
import { Copy, Check, Search, ArrowUpDown, Info } from 'lucide-react';

interface ResponseHeadersProps {
  headers: Record<string, string>;
}

const COMMON_HEADERS = new Set([
  'content-type',
  'content-length',
  'cache-control',
  'date',
  'server',
  'etag',
  'connection',
  'access-control-allow-origin',
]);

export const ResponseHeaders: React.FC<ResponseHeadersProps> = ({ headers }) => {
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');

  const entries = useMemo(() => {
    let list = Object.entries(headers);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q));
    }

    if (sortOrder === 'asc') {
      list = [...list].sort((a, b) => a[0].localeCompare(b[0]));
    } else if (sortOrder === 'desc') {
      list = [...list].sort((a, b) => b[0].localeCompare(a[0]));
    }

    return list;
  }, [headers, search, sortOrder]);

  const handleCopyValue = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAll = () => {
    const text = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const toggleSort = () => {
    if (sortOrder === 'default') setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder('default');
  };

  return (
    <div className="p-4 space-y-3 select-none">
      {/* Header controls strip */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search headers..."
              className="h-8 pl-8 pr-3 rounded-lg bg-slate-800/80 text-slate-200 placeholder:text-slate-500 font-mono text-xs border border-slate-700/80 focus:outline-none focus:border-cyan-400 w-48"
            />
          </div>

          <button
            type="button"
            onClick={toggleSort}
            className={`h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              sortOrder !== 'default'
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort {sortOrder !== 'default' ? sortOrder.toUpperCase() : 'A-Z'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyAll}
          disabled={Object.keys(headers).length === 0}
          className="h-8 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          {copiedAll ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied All</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy All ({Object.keys(headers).length})</span>
            </>
          )}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase font-sans border-b border-slate-800">
            <tr>
              <th className="px-4 py-2.5 w-2/5">Header Key</th>
              <th className="px-4 py-2.5">Value</th>
              <th className="w-14 px-3 py-2.5 text-center font-sans">Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500 font-sans">
                  {search ? 'No headers match your search query.' : 'No response headers accessible.'}
                </td>
              </tr>
            ) : (
              entries.map(([key, val]) => {
                const isCommon = COMMON_HEADERS.has(key.toLowerCase());
                return (
                  <tr key={key} className="hover:bg-slate-800/20 group">
                    <td className="px-4 py-2.5 text-slate-300 font-medium align-top">
                      <div className="flex items-center gap-2">
                        <span>{key}</span>
                        {isCommon && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/10 text-cyan-300 border border-blue-500/20 font-sans">
                            Standard
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-cyan-300 break-all select-text align-top font-mono">
                      {val}
                    </td>
                    <td className="px-3 py-2.5 text-center align-top">
                      <button
                        type="button"
                        onClick={() => handleCopyValue(key, val)}
                        title="Copy Value"
                        className="p-1 rounded text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {copiedKey === key ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Browser CORS Notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-300 font-medium">Browser Cross-Origin Header Visibility:</span>{' '}
          In browser environments, the Fetch API only exposes CORS-safelisted response headers
          unless the remote server explicitly exposes headers via{' '}
          <code className="text-cyan-300 font-mono">Access-Control-Expose-Headers</code>. In Phase
          7, desktop execution via Tauri / Rust will reveal 100% of network response headers.
        </div>
      </div>
    </div>
  );
};
