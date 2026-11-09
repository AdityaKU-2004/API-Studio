import React, { useState, useMemo } from 'react';
import { Modal } from '../../common/Modal';
import { parseCurlCommand, ParsedCurlResult } from '../../../services/request/curlParser';
import { useRequestStore } from '../../../stores/requestStore';
import { MethodBadge } from '../../common/MethodBadge';
import { Terminal, Check, AlertCircle, ArrowRight } from 'lucide-react';

interface CurlImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CurlImporterModal: React.FC<CurlImporterModalProps> = ({ isOpen, onClose }) => {
  const { addTab, updateActiveRequest } = useRequestStore();
  const [curlText, setCurlText] = useState('');
  const [targetMode, setTargetMode] = useState<'new-tab' | 'current-tab'>('new-tab');

  const parsedResult: ParsedCurlResult | null = useMemo(() => {
    if (!curlText.trim()) return null;
    return parseCurlCommand(curlText);
  }, [curlText]);

  const handleImport = () => {
    if (!parsedResult?.request) return;

    if (targetMode === 'new-tab') {
      addTab({
        name: `Imported (${parsedResult.request.method} ${new URL(parsedResult.request.url || 'http://localhost').pathname})`,
        ...parsedResult.request,
      });
    } else {
      updateActiveRequest({
        ...parsedResult.request,
      });
    }

    setCurlText('');
    onClose();
  };

  const sampleCurl = `curl --location 'https://api.example.com/v1/users?page=1' \\
  --header 'Content-Type: application/json' \\
  --header 'Accept: application/json' \\
  --header 'Authorization: Bearer token_sample_123' \\
  --data-raw '{"name": "Sarah Connor", "role": "engineer"}'`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import cURL Command"
      description="Paste any valid cURL shell command to automatically configure an API request"
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-slate-300 font-medium">cURL Command String</label>
            <button
              type="button"
              onClick={() => setCurlText(sampleCurl)}
              className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
            >
              Paste Sample cURL
            </button>
          </div>
          <textarea
            rows={6}
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            placeholder="curl -X POST https://api.example.com/items -H 'Content-Type: application/json' -d '...'"
            className="w-full p-3 rounded-lg bg-slate-950 font-mono text-xs text-cyan-300 border border-slate-800 focus:outline-none focus:border-cyan-400 resize-none"
          />
        </div>

        {/* Live parsed preview */}
        {parsedResult && (
          <div className="space-y-2">
            <span className="font-semibold text-slate-300">Parsed Preview</span>
            {parsedResult.success && parsedResult.request ? (
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                <div className="flex items-center gap-2">
                  <MethodBadge method={parsedResult.request.method!} size="sm" />
                  <span className="font-mono text-emerald-300 text-xs font-semibold truncate">
                    {parsedResult.request.url}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-300 font-mono">
                  <span>Headers: {parsedResult.request.headers?.length || 0}</span>
                  <span>Params: {parsedResult.request.params?.length || 0}</span>
                  <span>Auth: {parsedResult.request.auth?.type || 'none'}</span>
                  <span>Body: {parsedResult.request.bodyType || 'none'}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center gap-2 text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{parsedResult.error || 'Invalid cURL command structure'}</span>
              </div>
            )}
          </div>
        )}

        {/* Destination mode */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="curlTarget"
                checked={targetMode === 'new-tab'}
                onChange={() => setTargetMode('new-tab')}
                className="text-cyan-500 focus:ring-0 bg-slate-900"
              />
              <span>Open in New Tab</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="curlTarget"
                checked={targetMode === 'current-tab'}
                onChange={() => setTargetMode('current-tab')}
                className="text-cyan-500 focus:ring-0 bg-slate-900"
              />
              <span>Overwrite Current Tab</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!parsedResult?.success}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:brightness-110 active:brightness-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              Import Request
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
