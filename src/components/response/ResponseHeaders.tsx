import React from 'react';
import { Copy } from 'lucide-react';

interface ResponseHeadersProps {
  headers: Record<string, string>;
}

export const ResponseHeaders: React.FC<ResponseHeadersProps> = ({ headers }) => {
  const entries = Object.entries(headers);

  const handleCopyRow = (key: string, val: string) => {
    navigator.clipboard.writeText(`${key}: ${val}`);
  };

  return (
    <div className="p-3 select-none">
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase font-sans border-b border-slate-800">
            <tr>
              <th className="px-3 py-2 w-1/3">Header</th>
              <th className="px-3 py-2">Value</th>
              <th className="w-12 px-3 py-2 text-center font-sans">Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500 font-sans">
                  No response headers received.
                </td>
              </tr>
            ) : (
              entries.map(([key, val]) => (
                <tr key={key} className="hover:bg-slate-800/20 group">
                  <td className="px-3 py-2 text-slate-300 font-semibold">{key}</td>
                  <td className="px-3 py-2 text-cyan-300 break-all select-text">{val}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleCopyRow(key, val)}
                      title="Copy Header"
                      className="p-1 rounded text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
