import React, { useState } from 'react';
import { ShieldAlert, Lock, Server } from 'lucide-react';
import { certificateInspector } from '../../ssl/certificateService';
import { CertificateInspectionResult } from '../../../types';

export const SslInspectorTool: React.FC = () => {
  const [target, setTarget] = useState('https://api.github.com');
  const [result, setResult] = useState<CertificateInspectionResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleInspect = async () => {
    setIsChecking(true);
    try {
      const res = await certificateInspector.inspect(target, 443);
      setResult(res);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Hostname or HTTPS URL (e.g. api.github.com)"
          className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50"
        />
        <button
          type="button"
          onClick={handleInspect}
          disabled={isChecking}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{isChecking ? 'Checking...' : 'Inspect TLS Capabilities'}</span>
        </button>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200 leading-relaxed">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <div className="font-semibold text-amber-100">
            Browser Security Boundary — Native TLS Socket Required
          </div>
          <p>
            Web browsers isolate JavaScript from raw TLS handshakes and peer X.509 certificate stores.
            API Studio intentionally avoids fabricating certificate metadata or sending your target hostnames
            to third-party external lookup APIs.
          </p>
        </div>
      </div>

      {result && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="font-mono text-cyan-300">
              Target: {result.hostname || '—'}:{result.port}
            </div>
            <span className="font-mono text-slate-400">
              Mode: Browser Sandbox ({result.protocolSupported ? 'HTTPS/WSS' : 'Plaintext'})
            </span>
          </div>

          <p className="text-slate-300 leading-relaxed">{result.browserNotice}</p>

          <div className="space-y-1.5 pt-2">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Phase 7 Native Desktop (Tauri / Rust) Inspection Contract</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              {result.nativeCapabilitiesRequired.map((cap, idx) => (
                <li key={idx}>{cap}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
