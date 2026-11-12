import React, { useState } from 'react';
import { Copy, Check, WrapText, Search } from 'lucide-react';
import { ApiResponse } from '../../types';

interface ResponseRawViewProps {
  response: ApiResponse;
}

export const ResponseRawView: React.FC<ResponseRawViewProps> = ({ response }) => {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(response.rawBody || response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = (response.rawBody || response.body || '').split('\n');
  const filteredLines = searchQuery
    ? lines
        .map((line, idx) => ({ line, num: idx + 1 }))
        .filter((item) => item.line.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines.map((line, idx) => ({ line, num: idx + 1 }));

  return (
    <div className="flex flex-col h-full overflow-hidden select-text">
      {/* Sub-toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/60 bg-slate-900/40 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Search within raw response */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-400 absolute left-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search raw response..."
              className="h-7 pl-7 pr-2 rounded bg-slate-800 text-slate-200 placeholder:text-slate-500 font-mono text-[11px] border border-slate-700 focus:outline-none focus:border-cyan-400 w-44"
            />
          </div>

          <button
            type="button"
            onClick={() => setWordWrap(!wordWrap)}
            className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer ${
              wordWrap
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <WrapText className="w-3 h-3" />
            <span>Wrap</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span>{lines.length} lines</span>
          <span>{(response.rawBody || response.body || '').length} chars</span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer text-xs font-sans"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Raw</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Raw viewport */}
      <div className="flex-1 overflow-auto font-mono text-xs p-3 bg-[#0d1017]">
        {lines.length === 0 || (lines.length === 1 && !lines[0]) ? (
          <div className="text-slate-500 italic p-4 text-center">Empty response body</div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {filteredLines.map(({ line, num }) => (
                <tr key={num} className="hover:bg-slate-800/30">
                  <td className="w-10 pr-3 text-right text-slate-600 select-none text-[10px] align-top">
                    {num}
                  </td>
                  <td
                    className={`text-slate-200 pl-2 border-l border-slate-800/80 ${
                      wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                    }`}
                  >
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
