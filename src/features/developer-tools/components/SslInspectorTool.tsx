import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { getCertificateInspector } from '../../../services/runtime/transportFactory';
import { detectRuntimeCapabilities } from '../../../services/runtime/capabilities';
import { CertificateInspectionResult } from '../../../types';

export const SslInspectorTool: React.FC = () => {
  const [target, setTarget] = useState('https://api.github.com');
  const [result, setResult] = useState<CertificateInspectionResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const capabilities = detectRuntimeCapabilities();

  const handleInspect = async () => {
    setIsChecking(true);
    try {
      const inspector = getCertificateInspector();
      const res = await inspector.inspect(target, 443);
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
          <span>
            {isChecking
              ? 'Inspecting...'
              : capabilities.supportsCertificateInspection
              ? 'Inspect TLS Certificate'
              : 'Inspect TLS Capabilities'}
          </span>
        </button>
      </div>

      {!capabilities.supportsCertificateInspection && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200 leading-relaxed">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <div className="font-semibold text-amber-100">
              Browser Security Boundary — Native TLS Socket Required
            </div>
            <p>
              Web browsers isolate JavaScript from raw TLS handshakes and peer X.509 certificate stores.
              API Studio intentionally avoids fabricating certificate metadata or sending your target hostnames
              to third-party external lookup APIs. Run in API Studio Desktop (Tauri + Rust) to perform live
              X.509 chain inspection.
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="font-mono text-cyan-300">
              Target: {result.hostname || '—'}:{result.port}
            </div>
            <span className="font-mono text-slate-400">
              Mode:{' '}
              {result.mode === 'native-tauri'
                ? 'Native Desktop TLS (rustls)'
                : `Browser Sandbox (${result.protocolSupported ? 'HTTPS/WSS' : 'Plaintext'})`}
            </span>
          </div>

          <p className="text-slate-300 leading-relaxed">{result.browserNotice}</p>

          {result.certificate ? (
            <div className="space-y-4">
              {/* Verification Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center gap-2">
                  {result.certificate.trustVerified ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-[10px] text-slate-500">Trust Chain</div>
                    <div className="font-medium text-slate-200">
                      {result.certificate.trustVerified ? 'Trusted' : 'Untrusted / Warning'}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center gap-2">
                  {result.certificate.hostnameMatch ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-[10px] text-slate-500">Hostname Match</div>
                    <div className="font-medium text-slate-200">
                      {result.certificate.hostnameMatch ? 'Matches SAN/CN' : 'Mismatch'}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500">Validity Status</div>
                    <div className="font-medium text-slate-200 font-mono">
                      {result.certificate.isExpired
                        ? 'EXPIRED'
                        : `${result.certificate.daysRemaining ?? '—'}d remaining`}
                    </div>
                  </div>
                </div>
              </div>

              {result.certificate.verificationError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 font-mono text-[11px]">
                  Verification Notice: {result.certificate.verificationError}
                </div>
              )}

              {/* Primary Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <div className="text-[10px] text-slate-500">Subject</div>
                  <div className="font-mono text-slate-200 break-all">{result.certificate.subject}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Issuer</div>
                  <div className="font-mono text-slate-200 break-all">{result.certificate.issuer}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Valid From</div>
                  <div className="font-mono text-slate-300">{result.certificate.validFrom}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Valid To</div>
                  <div className="font-mono text-slate-300">{result.certificate.validTo}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Negotiated Protocol / Cipher</div>
                  <div className="font-mono text-cyan-300">
                    {result.certificate.protocol} — {result.certificate.cipherSuite}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Serial & Key</div>
                  <div className="font-mono text-slate-300 break-all">
                    {result.certificate.serialNumber} ({result.certificate.publicKeyAlgorithm}{' '}
                    {result.certificate.publicKeyBits ? `${result.certificate.publicKeyBits}-bit` : ''})
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-[10px] text-slate-500">SHA-256 Fingerprint</div>
                  <div className="font-mono text-slate-300 break-all">
                    {result.certificate.fingerprintSha256}
                  </div>
                </div>
                {result.certificate.subjectAltNames && result.certificate.subjectAltNames.length > 0 && (
                  <div className="md:col-span-2">
                    <div className="text-[10px] text-slate-500 mb-1">
                      Subject Alternative Names ({result.certificate.subjectAltNames.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.certificate.subjectAltNames.map((san) => (
                        <span
                          key={san}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300"
                        >
                          {san}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chain */}
              {result.certificate.chain && result.certificate.chain.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-200">
                    Certificate Chain ({result.certificate.chain.length} certificates)
                  </div>
                  <div className="space-y-2">
                    {result.certificate.chain.map((node) => (
                      <div
                        key={`${node.level}-${node.serialNumber}`}
                        className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/80 space-y-1 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between text-cyan-300">
                          <span>
                            #{node.level} {node.isCa ? '[CA]' : '[Leaf]'}
                          </span>
                          <span className={node.isExpired ? 'text-rose-400' : 'text-emerald-400'}>
                            {node.isExpired ? 'Expired' : 'Valid'}
                          </span>
                        </div>
                        <div className="text-slate-200 break-all">Subject: {node.subject}</div>
                        <div className="text-slate-400 break-all">Issuer: {node.issuer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            result.nativeCapabilitiesRequired.length > 0 && (
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
            )
          )}
        </div>
      )}
    </div>
  );
};
