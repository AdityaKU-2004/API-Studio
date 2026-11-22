import React, { useState } from 'react';
import { ShieldAlert, Clock, Copy, Check } from 'lucide-react';
import { decodeJwtLocal } from '../services/tokenAndCodecTools';

// Sample non-secret demo JWT (unsigned example payload)
const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMTAxIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImlzcyI6ImFwaS1zdHVkaW8ubG9jYWwiLCJpYXQiOjE3MDAwMDAwMDB9.demo_signature_segment';

export const JwtDecoderTool: React.FC = () => {
  const [token, setToken] = useState(SAMPLE_JWT);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const decoded = decodeJwtLocal(token);

  const expirationBadge = () => {
    switch (decoded.expirationStatus) {
      case 'valid':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'expired':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      case 'not_yet_valid':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Local Inspection Only · Signature Not Verified:</span>{' '}
          {decoded.securityNotice} Zero token data leaves your browser.
        </div>
      </div>

      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste JWT (header.payload.signature) or Bearer token..."
        spellCheck={false}
        className="h-24 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
      />

      {!decoded.validStructure ? (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {decoded.error}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className={`px-2 py-0.5 rounded border ${expirationBadge()}`}>
              {decoded.expirationStatus.replace('_', ' ').toUpperCase()}
            </span>
            <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
              SIGNATURE UNVERIFIED
            </span>
            {decoded.algorithm && <span className="text-slate-300">alg: {decoded.algorithm}</span>}
            {decoded.issuer && <span className="text-slate-400">iss: {decoded.issuer}</span>}
            {decoded.subject && <span className="text-slate-400">sub: {decoded.subject}</span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900/70 border-b border-slate-800 text-xs font-semibold text-slate-300">
                Header
              </div>
              <pre className="p-3 font-mono text-xs text-purple-300 overflow-auto flex-1 select-text">
                {JSON.stringify(decoded.header, null, 2)}
              </pre>
            </div>

            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Payload Claims</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(decoded.payload, null, 2));
                    setCopiedPayload(true);
                    setTimeout(() => setCopiedPayload(false), 1500);
                  }}
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy JSON</span>
                </button>
              </div>
              <pre className="p-3 font-mono text-xs text-emerald-300 overflow-auto flex-1 select-text">
                {JSON.stringify(decoded.payload, null, 2)}
              </pre>
            </div>
          </div>

          {(decoded.issuedAtIso || decoded.expiresAtIso || decoded.notBeforeIso) && (
            <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              {decoded.issuedAtIso && <span>iat: {decoded.issuedAtIso}</span>}
              {decoded.notBeforeIso && <span>nbf: {decoded.notBeforeIso}</span>}
              {decoded.expiresAtIso && <span>exp: {decoded.expiresAtIso}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
};
