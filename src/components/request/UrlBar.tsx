import React, { useState, useMemo } from 'react';
import {
  Send,
  Save,
  Code,
  Copy,
  Check,
  X,
  FileCode,
  Eye,
  Terminal,
  MoreHorizontal,
  Loader2,
  BookmarkPlus,
} from 'lucide-react';
import { MethodSelector } from './MethodSelector';
import { SendButton } from './SendButton';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { HttpMethod } from '../../types';
import { ensureProtocol } from '../../services/request/urlBuilder';
import { generateCurlCommand } from '../../services/request/curlGenerator';
import { CurlImporterModal } from './import-export/CurlImporterModal';
import { RequestJsonModal } from './import-export/RequestJsonModal';
import { RequestPreviewModal } from './preview/RequestPreviewModal';
import { SaveRequestAsModal } from './SaveRequestAsModal';

export const UrlBar: React.FC = () => {
  const {
    tabs,
    activeTabId,
    updateActiveRequest,
    updateUrlAndSyncParams,
    saveActiveRequest,
    sendRequest,
    isSending,
  } = useRequestStore();

  const { getResolvedVariables } = useEnvironmentStore();

  const [isCurlImportOpen, setIsCurlImportOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateUrlAndSyncParams(e.target.value);
  };

  const handleUrlBlur = () => {
    if (request.url.trim() && !request.url.includes('://') && !request.url.startsWith('{{')) {
      const formatted = ensureProtocol(request.url);
      updateUrlAndSyncParams(formatted);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendRequest();
    }
  };

  const handleClearUrl = () => {
    updateUrlAndSyncParams('');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(request.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleQuickCopyCurl = () => {
    const vars = getResolvedVariables();
    const cmd = generateCurlCommand(request, { resolvedVariables: vars, multiline: true });
    navigator.clipboard.writeText(cmd);
    setIsMoreMenuOpen(false);
  };

  return (
    <div className="space-y-1.5 select-none">
      <div className="flex items-center gap-1.5">
        {/* Method selector + URL input container */}
        <div className="flex-1 flex items-center min-w-0">
          <MethodSelector
            method={request.method}
            onChange={(method: HttpMethod) => updateActiveRequest({ method })}
          />

          <div className="relative flex-1 min-w-0 flex items-center">
            <input
              type="text"
              value={request.url}
              onChange={handleUrlChange}
              onBlur={handleUrlBlur}
              onKeyDown={handleKeyDown}
              placeholder="Enter request URL (e.g. {{base_url}}/users or https://api.example.com)"
              className="w-full h-9 pl-3 pr-14 rounded-r-lg bg-[#141923] dark:bg-[#141923] light:bg-slate-50 text-slate-100 dark:text-slate-100 light:text-slate-900 placeholder:text-slate-500 font-mono text-xs border border-l-0 border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
            />

            {/* Quick URL actions (Copy & Clear) inside the input */}
            <div className="absolute right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyUrl}
                title="Copy URL"
                className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>

              {request.url && (
                <button
                  type="button"
                  onClick={handleClearUrl}
                  title="Clear URL"
                  className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Send Button */}
        <SendButton />

        {/* Save Button */}
        <button
          type="button"
          onClick={saveActiveRequest}
          title="Save Request (Ctrl+S)"
          className="h-9 px-3 rounded-lg bg-slate-800/80 dark:bg-slate-800/80 light:bg-slate-100 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-slate-100 hover:bg-slate-700/60 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0"
        >
          <Save className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* More Actions Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            title="Request actions & import/export"
            className="h-9 px-2.5 rounded-lg bg-slate-800/80 dark:bg-slate-800/80 light:bg-slate-100 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-cyan-400 transition-colors flex items-center justify-center cursor-pointer shrink-0"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 border border-blue-500/25 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsSaveAsOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-blue-600/20 cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Save Request As...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsPreviewOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-blue-600/20 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Configuration Preview</span>
              </button>

              <div className="border-t border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 my-1" />

              <button
                type="button"
                onClick={handleQuickCopyCurl}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-blue-600/20 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copy as cURL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsCurlImportOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-blue-600/20 cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-purple-400" />
                <span>Import cURL Command</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsJsonModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-blue-600/20 cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Import / Export JSON</span>
              </button>
            </div>
          )}
        </div>
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

      {/* Modals */}
      <CurlImporterModal
        isOpen={isCurlImportOpen}
        onClose={() => setIsCurlImportOpen(false)}
      />
      <RequestJsonModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        activeRequest={request}
      />
      <RequestPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        request={request}
      />
      <SaveRequestAsModal
        isOpen={isSaveAsOpen}
        onClose={() => setIsSaveAsOpen(false)}
      />
    </div>
  );
};
