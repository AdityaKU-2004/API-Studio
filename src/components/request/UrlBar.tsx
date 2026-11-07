import React, { useMemo } from 'react';
import { Send, Save, Code, Copy, MoreHorizontal, Loader2 } from 'lucide-react';
import { MethodSelector } from './MethodSelector';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useAppStore } from '../../stores/appStore';
import { HttpMethod } from '../../types';

export const UrlBar: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest, saveActiveRequest, sendRequest, isSending } = useRequestStore();
  const { getResolvedVariables } = useEnvironmentStore();
  const { setCodeSnippetModalOpen } = useAppStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const resolvedPreview = useMemo(() => {
    if (!request?.url) return '';
    let preview = request.url;
    const vars = getResolvedVariables();
    let hasVariable = false;
    for (const [k, v] of Object.entries(vars)) {
      if (preview.includes(`{{${k}}}`)) {
        hasVariable = true;
        preview = preview.replaceAll(`{{${k}}}`, v);
      }
    }
    return hasVariable ? preview : '';
  }, [request?.url, getResolvedVariables]);

  if (!request) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendRequest();
    }
  };

  const handleCopyCurl = () => {
    const vars = getResolvedVariables();
    let finalUrl = request.url;
    for (const [k, v] of Object.entries(vars)) {
      finalUrl = finalUrl.replaceAll(`{{${k}}}`, v);
    }
    const curl = `curl --request ${request.method} --url '${finalUrl}'`;
    navigator.clipboard.writeText(curl);
  };

  return (
    <div className="space-y-1 select-none">
      <div className="flex items-center gap-1.5">
        {/* Combined Method selector + URL input container */}
        <div className="flex-1 flex items-center min-w-0">
          <MethodSelector
            method={request.method}
            onChange={(method: HttpMethod) => updateActiveRequest({ method })}
          />

          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={request.url}
              onChange={(e) => updateActiveRequest({ url: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="Enter request URL (e.g. {{base_url}}/users or https://api.example.com)"
              className="w-full h-9 px-3 rounded-r-lg bg-[#141923] dark:bg-[#141923] light:bg-slate-50 text-slate-100 dark:text-slate-100 light:text-slate-900 placeholder:text-slate-500 font-mono text-xs border border-l-0 border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
            />
          </div>
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={sendRequest}
          disabled={isSending}
          title="Send Request (Ctrl+Enter)"
          className="h-9 px-4 rounded-lg bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_16px_rgba(6,182,212,0.35)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] hover:brightness-110 active:brightness-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          {isSending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3 h-3" />
            </>
          )}
        </button>

        {/* Save Button */}
        <button
          type="button"
          onClick={saveActiveRequest}
          title="Save Request Changes (Ctrl+S)"
          className="h-9 px-3 rounded-lg bg-slate-800/80 dark:bg-slate-800/80 light:bg-slate-100 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-slate-100 hover:bg-slate-700/60 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0"
        >
          <Save className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* Code Snippet Modal Button */}
        <button
          type="button"
          onClick={() => setCodeSnippetModalOpen(true)}
          title="Generate Code Snippet (cURL, Fetch, Python, Go, Rust)"
          className="h-9 px-2.5 rounded-lg bg-slate-800/80 dark:bg-slate-800/80 light:bg-slate-100 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-cyan-400 transition-colors flex items-center justify-center cursor-pointer shrink-0"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Variable resolution preview line */}
      {resolvedPreview && (
        <div className="flex items-center gap-2 px-2 text-[11px] text-slate-400 font-mono truncate">
          <span className="text-cyan-400 font-sans font-medium text-[10px] uppercase tracking-wide">
            Resolves to:
          </span>
          <span className="text-slate-300 truncate">{resolvedPreview}</span>
        </div>
      )}
    </div>
  );
};
