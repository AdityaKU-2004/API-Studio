import React from 'react';
import { ResponseCookie } from '../../types';

interface ResponseCookiesProps {
  cookies: ResponseCookie[];
}

export const ResponseCookies: React.FC<ResponseCookiesProps> = ({ cookies }) => {
  return (
    <div className="p-3 select-none">
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase font-sans border-b border-slate-800">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2">Path</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2 text-center">HttpOnly</th>
              <th className="px-3 py-2 text-center">Secure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {cookies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                  No response cookies set by this request.
                </td>
              </tr>
            ) : (
              cookies.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-800/20">
                  <td className="px-3 py-2 text-slate-200 font-semibold">{c.name}</td>
                  <td className="px-3 py-2 text-cyan-300 break-all select-text">{c.value}</td>
                  <td className="px-3 py-2 text-slate-400">{c.domain || '/'}</td>
                  <td className="px-3 py-2 text-slate-400">{c.path || '/'}</td>
                  <td className="px-3 py-2 text-slate-400">{c.expires || 'Session'}</td>
                  <td className="px-3 py-2 text-center text-emerald-400">
                    {c.httpOnly ? '✓' : '–'}
                  </td>
                  <td className="px-3 py-2 text-center text-emerald-400">
                    {c.secure ? '✓' : '–'}
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
