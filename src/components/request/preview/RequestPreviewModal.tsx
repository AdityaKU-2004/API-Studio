import React from 'react';
import { Modal } from '../../common/Modal';
import { MethodBadge } from '../../common/MethodBadge';
import { ApiRequest } from '../../../types';
import { buildUrlWithParams } from '../../../services/request/urlBuilder';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useAuthStore } from '../../../stores/authStore';
import { Globe, Layers, Key, FileText, Settings, Shield } from 'lucide-react';

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
  const { getResolvedVariables } = useEnvironmentStore();
  const { resolveEffectiveAuth } = useAuthStore();

  const vars = getResolvedVariables();

  // Calculate resolved URL
  let resolvedUrl = buildUrlWithParams(request.url, request.params, request.settings?.autoEncodeUrl ?? true);
  for (const [k, v] of Object.entries(vars)) {
    resolvedUrl = resolvedUrl.replaceAll(`{{${k}}}`, v);
  }

  // Calculate effective headers including auth
  const enabledHeaders = [...request.headers.filter((h) => h.enabled && h.key)];
  const effectiveAuth = resolveEffectiveAuth(request.auth, request.collectionId, request.folderId);

  let generatedAuthHeader: string | null = null;
  if (effectiveAuth.effectiveAuth.type === 'bearer' && effectiveAuth.effectiveAuth.bearer?.token) {
    let token = effectiveAuth.effectiveAuth.bearer.token;
    for (const [k, v] of Object.entries(vars)) {
      token = token.replaceAll(`{{${k}}}`, v);
    }
    generatedAuthHeader = `${effectiveAuth.effectiveAuth.bearer.prefix || 'Bearer'} ${token}`;
  } else if (effectiveAuth.effectiveAuth.type === 'apikey' && effectiveAuth.effectiveAuth.apikey?.enabled && effectiveAuth.effectiveAuth.apikey.addTo === 'header') {
    let val = effectiveAuth.effectiveAuth.apikey.value;
    for (const [k, v] of Object.entries(vars)) {
      val = val.replaceAll(`{{${k}}}`, v);
    }
    generatedAuthHeader = val;
  }

  // Body preview
  const bodySize = request.rawBody ? new Blob([request.rawBody]).size : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Configuration Summary"
      description="Inspect estimated request payload, headers, and resolved endpoint parameters"
      maxWidth="3xl"
    >
      <div className="space-y-5 text-xs text-slate-300">
        {/* Method & URL */}
        <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2">
          <div className="flex items-center gap-2">
            <MethodBadge method={request.method} size="md" />
            <span className="font-mono text-cyan-300 text-xs font-semibold break-all">
              {resolvedUrl}
            </span>
          </div>
          {request.url !== resolvedUrl && (
            <div className="text-[11px] text-slate-400 font-mono">
              Raw Template: {request.url}
            </div>
          )}
        </div>

        {/* Query Params Breakdown */}
        <div>
          <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            Query Parameters ({request.params.filter((p) => p.enabled && p.key).length} Active)
          </h4>
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 font-mono text-xs max-h-36 overflow-y-auto">
            {request.params.filter((p) => p.enabled && p.key).length === 0 ? (
              <span className="text-slate-500 font-sans">No active query parameters</span>
            ) : (
              request.params
                .filter((p) => p.enabled && p.key)
                .map((p) => (
                  <div key={p.id} className="flex justify-between py-0.5">
                    <span className="text-slate-300">{p.key}:</span>
                    <span className="text-cyan-300">{p.value}</span>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Headers Breakdown */}
        <div>
          <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Outgoing Headers ({enabledHeaders.length + (generatedAuthHeader ? 1 : 0)} Active)
          </h4>
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 font-mono text-xs max-h-40 overflow-y-auto space-y-1">
            {generatedAuthHeader && (
              <div className="flex justify-between py-0.5 text-amber-300 bg-amber-500/10 px-2 rounded">
                <span>Authorization (Auth Tab):</span>
                <span className="truncate max-w-sm">{generatedAuthHeader}</span>
              </div>
            )}
            {enabledHeaders.map((h) => (
              <div key={h.id} className="flex justify-between py-0.5 px-2">
                <span className="text-slate-300">{h.key}:</span>
                <span className="text-cyan-300 truncate max-w-sm">{h.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Authentication & Body Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authentication</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Scheme: <span className="text-cyan-300 font-mono uppercase">{effectiveAuth.effectiveAuth.type}</span>
            </div>
            <div className="text-[11px] text-slate-500">Source: {effectiveAuth.sourceName}</div>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>Body Payload</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Mode: <span className="text-cyan-300 font-mono uppercase">{request.bodyType || 'none'}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Estimated Size: {(bodySize / 1024).toFixed(2)} KB ({bodySize} bytes)
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
