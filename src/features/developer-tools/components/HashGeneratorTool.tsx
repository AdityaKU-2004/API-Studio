import React, { useEffect, useState } from 'react';
import { Copy, Check, Upload, ShieldCheck } from 'lucide-react';
import { generateHash, HashAlgorithm } from '../services/cryptoAndIdTools';

const ALGORITHMS: HashAlgorithm[] = ['SHA-256', 'SHA-384', 'SHA-512'];

export const HashGeneratorTool: React.FC = () => {
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256');
  const [inputText, setInputText] = useState('api-studio-payload');
  const [fileInfo, setFileInfo] = useState<{ name: string; buffer: ArrayBuffer } | null>(null);
  const [digest, setDigest] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      try {
        setError(null);
        const source = fileInfo ? fileInfo.buffer : inputText;
        const hex = await generateHash(source, algorithm);
        if (!cancelled) setDigest(hex);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Hash calculation failed.');
          setDigest('');
        }
      }
    };
    void compute();
    return () => {
      cancelled = true;
    };
  }, [inputText, fileInfo, algorithm]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setFileInfo({ name: `${file.name} (${file.size.toLocaleString()} bytes)`, buffer });
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {ALGORITHMS.map((alg) => (
            <button
              key={alg}
              type="button"
              onClick={() => setAlgorithm(alg)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer ${
                algorithm === alg
                  ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {alg}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hash Local File</span>
            <input type="file" onChange={handleFileChange} className="hidden" />
          </label>
          {fileInfo && (
            <button
              type="button"
              onClick={() => setFileInfo(null)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Clear File
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>Computed locally using the browser Web Crypto API (`crypto.subtle.digest`).</span>
      </div>

      {fileInfo ? (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300">
          Hashing file: {fileInfo.name}
        </div>
      ) : (
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter text to hash..."
          spellCheck={false}
          className="h-40 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
        />
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Hex Digest ({algorithm})</span>
          <button
            type="button"
            onClick={() => {
              if (!digest) return;
              navigator.clipboard.writeText(digest);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-slate-300 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy</span>
          </button>
        </div>
        <div className="font-mono text-xs text-emerald-300 break-all select-text">{digest}</div>
      </div>
    </div>
  );
};
