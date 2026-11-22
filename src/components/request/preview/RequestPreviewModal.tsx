import React, { useMemo } from 'react';
import { Modal } from '../../common/Modal';
import { MethodBadge } from '../../common/MethodBadge';
import { ApiRequest } from '../../../types';
import { useDiagnosticsStore } from '../../../stores/diagnosticsStore';
import { Globe, Layers, Key, FileText, AlertTriangle, Info } from 'lucide-react';
import { formatBytes } from '../../../utils/formatBytes';

interface RequestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApiRequest;
}

export const RequestPreviewModal: React.FC<RequestPreviewModalProps> = ({
  isOpen,
  onClose,
  request,
}) => {
  const buildPreview = useDiagnosticsStore((s) => s.buildPreview);
  const preview = useMemo(() => buildPreview(request), [buildPreview, request]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pre-Execution Request Preview"
      description="Inspect resolved URL, parameters, masked headers, authentication, and browser header controls"
      maxWidth="3xl"
    >
      <div className="space-y-4 text-xs text-slate-300">
        {/* Method & Resolved URL */}
        <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2">
          <div className="flex items-center gap-2">
            <MethodBadge method={request.method} requestType={preview.protocol} size="md" />
            <span className="font-mono text-cyan-300 text-xs font-semibold break-all">
              {preview.resolvedUrl || '(empty URL)'}
            </span>
          </div>
          {preview.rawUrl !== preview.resolvedUrl && (
            <div className="text-[11px] text-slate-400 font-mono break-all">
              Raw Template: {preview.rawUrl}
            </div>
          )}
        </div>

        {/* Unresolved variables warning */}
        {preview.unresolvedVariables.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Unresolved Variables Detected</div>
              <div className="text-[11px] font-mono mt-0.5">
                {preview.unresolvedVariables.map((v) => `{{${v}}}`).join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Query Params Breakdown */}
        <div>
          <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            Query Parameters ({preview.resolvedParams.length} Active)
          </h4>
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 font-mono text-xs max-h-32 overflow-y-auto">
            {preview.resolvedParams.length === 0 ? (
              <span className="text-slate-500 font-sans">No active query parameters</span>
            ) : (
              preview.resolvedParams.map((p, i) => (
                <div key={i} className="flex justify-between py-0.5 px-1 gap-4">
                  <span className="text-slate-300 shrink-0">{p.key}:</span>
                  <span className="text-cyan-300 break-all text-right">{p.value}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Headers Attempted (with secrets masked) */}
        <div>
          <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Headers Attempted ({preview.headersAttempted.length} · Sensitive Values Masked)
          </h4>
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 font-mono text-xs max-h-40 overflow-y-auto space-y-1">
            {preview.headersAttempted.length === 0 ? (
              <span className="text-slate-500 font-sans">No custom headers configured</span>
            ) : (
              preview.headersAttempted.map((h, i) => (
                <div
                  key={i}
                  className={`flex justify-between py-0.5 px-2 rounded gap-4 ${
                    h.masked ? 'bg-amber-500/10 text-amber-300' : ''
                  }`}
                >
                  <span className="text-slate-300 shrink-0">
                    {h.key} <span className="text-[10px] text-slate-500">({h.source})</span>
                  </span>
                  <span className="text-cyan-300 truncate max-w-sm">{h.value}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Authentication & Body Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authentication (Masked)</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Scheme:{' '}
              <span className="text-cyan-300 font-mono uppercase">{preview.authSummary.type}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {preview.authSummary.maskedSummary}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>Body Payload</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Mode: <span className="text-cyan-300 font-mono uppercase">{preview.bodyMode}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums">
              Estimated Size: {formatBytes(preview.estimatedBodySizeBytes)} (
              {preview.estimatedBodySizeBytes} bytes)
            </div>
          </div>
        </div>

        {/* Browser-controlled forbidden headers notice */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Browser-Controlled Forbidden Headers (Fetch Spec)</span>
          </div>
          <p className="text-slate-400">
            Browsers ignore or override user-supplied values for:{' '}
            <span className="font-mono text-slate-300">
              {preview.browserControlledHeaders.join(', ')}
            </span>
          </p>
        </div>
      </div>
    </Modal>
  );
};
