import React, { useState } from 'react';
import { Copy, Download, Trash2, Check, Clock, HardDrive, Calendar } from 'lucide-react';
import { ApiResponse } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';
import { ResponseStatus } from './ResponseStatus';
import { formatBytes } from '../../utils/formatBytes';
import { formatDuration } from '../../utils/formatDuration';

interface ResponseToolbarProps {
  response: ApiResponse;
}

export const ResponseToolbar: React.FC<ResponseToolbarProps> = ({ response }) => {
  const { activeResponseTab, setActiveResponseTab } = useUiStore();
  const { setResponse } = useRequestStore();

  const [copied, setCopied] = useState(false);

  const handleCopyBody = () => {
    navigator.clipboard.writeText(response.rawBody || response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    let blob: Blob;
    let filename = `response_${response.status}_${Date.now()}`;

    if (response.binaryDataUrl) {
      const a = document.createElement('a');
      a.href = response.binaryDataUrl;
      a.download = filename;
      a.click();
      return;
    }

    if (response.contentTypeCategory === 'json') {
      blob = new Blob([response.body], { type: 'application/json' });
      filename += '.json';
    } else if (response.contentTypeCategory === 'html') {
      blob = new Blob([response.body], { type: 'text/html' });
      filename += '.html';
    } else if (response.contentTypeCategory === 'xml') {
      blob = new Blob([response.body], { type: 'application/xml' });
      filename += '.xml';
    } else {
      blob = new Blob([response.body], { type: 'text/plain' });
      filename += '.txt';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: typeof activeResponseTab; label: string; count?: number }[] = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers', count: Object.keys(response.headers || {}).length },
    { id: 'cookies', label: 'Cookies', count: response.cookies?.length || 0 },
    { id: 'tests', label: 'Tests', count: response.tests?.length || 0 },
    { id: 'timing', label: 'Timing' },
  ];

  return (
    <div className="flex flex-col border-b border-slate-800/80 bg-[#121620]/90 dark:bg-[#121620]/90 light:bg-slate-50 select-none shrink-0">
      {/* Top Status Strip */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 flex-wrap gap-2">
        {/* Status code + time + size metrics */}
        <div className="flex items-center gap-3 flex-wrap">
          <ResponseStatus
            status={response.status}
            statusText={response.statusText}
            isError={response.status === 0 || !!response.error}
          />

          <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Time: </span>
            <span className="text-slate-200 font-semibold">{formatDuration(response.timeMs)}</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>Size: </span>
            <span className="text-slate-200 font-semibold">{formatBytes(response.size || response.sizeBytes || 0)}</span>
          </div>

          {response.receivedAt && (
            <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-500 font-mono">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{new Date(response.receivedAt).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopyBody}
            title="Copy Response Body"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            title="Download Response"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setResponse(null)}
            title="Clear Response"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs Strip */}
      <div className="flex items-center gap-1 px-3 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeResponseTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveResponseTab(tab.id)}
              className={`relative py-2 px-3 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-cyan-400 dark:text-cyan-400 light:text-blue-600 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-cyan-300 font-mono">
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
