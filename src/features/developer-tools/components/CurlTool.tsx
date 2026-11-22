import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { inspectAndParseCurl } from '../services/curlColorRegexTools';
import { generateCurlCommand } from '../../../services/request/curlGenerator';
import { createDefaultRequest, useRequestStore } from '../../../stores/requestStore';
import { useAppStore } from '../../../stores/appStore';

export const CurlTool: React.FC = () => {
  const { openRequestInTab, tabs, activeTabId } = useRequestStore();
  const { setActiveView } = useAppStore();

  const [curlText, setCurlText] = useState(
    `curl -X POST 'https://httpbin.org/post' -H 'Content-Type: application/json' -H 'Accept: application/json' --data-raw '{"hello":"api studio"}'`
  );
  const [copied, setCopied] = useState(false);

  const parsed = inspectAndParseCurl(curlText);
  const parsedReq = parsed.request;
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeHttpRequest =
    activeTab?.request && (!activeTab.request.requestType || activeTab.request.requestType === 'http')
      ? activeTab.request
      : undefined;

  const handleOpenInTab = () => {
    if (!parsed.success || !parsedReq?.url) return;
    const base = createDefaultRequest(
      parsedReq.name || 'Imported cURL Request',
      parsedReq.method || 'GET'
    );
    openRequestInTab({
      ...base,
      ...parsedReq,
      id: 'curl-' + Date.now(),
      requestType: 'http',
      settings: base.settings,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setActiveView('collections');
  };

  const handleLoadActiveRequest = () => {
    if (!activeHttpRequest) return;
    setCurlText(generateCurlCommand(activeHttpRequest, { multiline: true }));
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadActiveRequest}
            disabled={!activeHttpRequest}
            className="px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs text-slate-300 cursor-pointer"
          >
            Generate from Active Tab
          </button>
          <button
            type="button"
            onClick={handleOpenInTab}
            disabled={!parsed.success || !parsedReq?.url}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in New Request Tab</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(curlText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>Copy cURL</span>
        </button>
      </div>

      <textarea
        value={curlText}
        onChange={(e) => setCurlText(e.target.value)}
        placeholder="Paste a curl command (never executes shell commands)..."
        spellCheck={false}
        className="h-32 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
      />

      {!parsed.success && parsed.error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {parsed.error}
        </div>
      )}

      {parsed.warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs text-amber-200">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Unsupported / Native-Only Flags Detected</span>
          </div>
          {parsed.warnings.map((w, idx) => (
            <div key={idx} className="font-mono text-[11px] pl-5">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="font-semibold text-slate-300">Parsed Target</div>
          <div className="font-mono space-y-1">
            <div>
              <span className="text-slate-500">Method: </span>
              <span className="text-emerald-300">{parsedReq?.method || '—'}</span>
            </div>
            <div className="break-all">
              <span className="text-slate-500">URL: </span>
              <span className="text-cyan-300">{parsedReq?.url || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Body Type: </span>
              <span className="text-slate-200">{parsedReq?.bodyType || 'none'}</span>
            </div>
            <div>
              <span className="text-slate-500">Auth: </span>
              <span className="text-slate-200">{parsedReq?.auth?.type || 'none'}</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="font-semibold text-slate-300">
            Headers ({parsedReq?.headers?.length || 0}) & Query Params ({parsedReq?.params?.length || 0})
          </div>
          <pre className="font-mono text-[11px] text-slate-300 max-h-40 overflow-auto select-text">
            {JSON.stringify(
              {
                headers: parsedReq?.headers || [],
                params: parsedReq?.params || [],
                rawBody: parsedReq?.rawBody || '',
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  );
};
