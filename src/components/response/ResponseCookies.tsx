import React, { useState } from 'react';
import { Copy, Check, Info, Cookie as CookieIcon, ShieldAlert } from 'lucide-react';
import { ResponseCookie } from '../../types';

interface ResponseCookiesProps {
  cookies: ResponseCookie[];
}

export const ResponseCookies: React.FC<ResponseCookiesProps> = ({ cookies }) => {
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = cookies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.value.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopy = (name: string, val: string) => {
    navigator.clipboard.writeText(`${name}=${val}`);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  return (
    <div className="p-4 space-y-4 select-none">
      {/* Header controls strip */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <CookieIcon className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-200">
            Accessible Response Cookies ({cookies.length})
          </span>
        </div>

        {cookies.length > 0 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cookies..."
            className="h-7 px-2.5 rounded bg-slate-800 text-slate-200 placeholder:text-slate-500 font-mono text-xs border border-slate-700 focus:outline-none focus:border-cyan-400 w-44"
          />
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase font-sans border-b border-slate-800">
            <tr>
              <th className="px-3.5 py-2.5">Name</th>
              <th className="px-3.5 py-2.5">Value</th>
              <th className="px-3.5 py-2.5">Domain</th>
              <th className="px-3.5 py-2.5">Path</th>
              <th className="px-3.5 py-2.5">Expires</th>
              <th className="px-3 py-2.5 text-center">HttpOnly</th>
              <th className="px-3 py-2.5 text-center">Secure</th>
              <th className="w-12 px-2 py-2.5 text-center font-sans">Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                  {cookies.length === 0
                    ? 'No client-accessible cookies received for this domain.'
                    : 'No cookies match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-800/20">
                  <td className="px-3.5 py-2.5 text-slate-200 font-semibold">{c.name}</td>
                  <td className="px-3.5 py-2.5 text-cyan-300 break-all select-text">{c.value}</td>
                  <td className="px-3.5 py-2.5 text-slate-400">{c.domain || 'host'}</td>
                  <td className="px-3.5 py-2.5 text-slate-400">{c.path || '/'}</td>
                  <td className="px-3.5 py-2.5 text-slate-400">{c.expires || 'Session'}</td>
                  <td className="px-3 py-2.5 text-center text-emerald-400">
                    {c.httpOnly ? '✓' : '–'}
                  </td>
                  <td className="px-3 py-2.5 text-center text-emerald-400">
                    {c.secure ? '✓' : '–'}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleCopy(c.name, c.value)}
                      title="Copy Cookie"
                      className="p-1 rounded text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {copiedName === c.name ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Browser Fetch Security Notice */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-300 font-medium">Browser Cookie Sandboxing Policy:</span>{' '}
          In browser JavaScript environments, the W3C Fetch specification explicitly forbids
          scripts from reading <code className="text-cyan-300 font-mono">Set-Cookie</code> response
          headers and <code className="text-cyan-300 font-mono">HttpOnly</code> cookies for security.
          Only client-accessible non-HttpOnly same-origin cookies can be inspected here. In Phase
          7, API Studio's desktop Rust HTTP engine will manage an isolated, fully inspectable cookie jar.
        </div>
      </div>
    </div>
  );
};
