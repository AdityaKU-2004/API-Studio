import React, { useState } from 'react';
import { Copy, Download, Trash2, Check, Clock, HardDrive } from 'lucide-react';
import { ApiResponse } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';

interface ResponseToolbarProps {
  response: ApiResponse;
}

export const ResponseToolbar: React.FC<ResponseToolbarProps> = ({ response }) => {
  const { activeResponseTab, setActiveResponseTab } = useUiStore();
  const { setResponse } = useRequestStore();

  const [copied, setCopied] = useState(false);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (status >= 300 && status < 400) return 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30';
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    return 'text-red-400 bg-red-500/15 border-red-500/30';
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([response.body], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${response.status}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: typeof activeResponseTab; label: string; count?: number }[] = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers', count: Object.keys(response.headers).length },
    { id: 'cookies', label: 'Cookies', count: response.cookies.length },
    { id: 'tests', label: 'Tests', count: response.tests.length },
  ];

  return (
    <div className="flex flex-col border-b border-slate-800/80 bg-[#121620]/90 dark:bg-[#121620]/90 light:bg-slate-50 select-none shrink-0">
      {/* Top Status Strip */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 flex-wrap gap-2">
        {/* Status code + time + size metrics */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-mono text-xs font-semibold ${getStatusColor(
              response.status
            )} shadow-sm`}
          >
            <span>Status:</span>
            <span>{response.status}</span>
            <span>{response.statusText}</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Time: </span>
            <span className="text-slate-200 font-semibold">{response.timeMs}ms</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>Size: </span>
            <span className="text-slate-200 font-semibold">{formatBytes(response.sizeBytes)}</span>
          </div>
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
            title="Download Response JSON"
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
      <div className="flex items-center gap-1 px-3">
        {tabs.map((tab) => {
          const isActive = activeResponseTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveResponseTab(tab.id)}
              className={`relative py-2 px-3 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
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
