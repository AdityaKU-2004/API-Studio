import React, { useState, useMemo } from 'react';
import {
  Search,
  Trash2,
  Clock,
  ExternalLink,
  Filter,
  ArrowUpDown,
  FileCode,
  FolderPlus,
  X,
  Copy,
  Check,
  Shield,
} from 'lucide-react';
import { useHistoryStore } from '../../stores/historyStore';
import { useRequestStore } from '../../stores/requestStore';
import { useAppStore } from '../../stores/appStore';
import { MethodBadge } from '../common/MethodBadge';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { HistoryItem } from '../../types';

interface HistoryPageProps {
  isSidebarView?: boolean;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ isSidebarView = false }) => {
  const { history, clearHistory, deleteHistoryItem, retentionLimit, setRetentionLimit, retainResponseBody, setRetainResponseBody } = useHistoryStore();
  const { openRequestInTab } = useRequestStore();
  const { setNewRequestModalOpen } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | '2xx' | '3xx' | '4xx' | '5xx' | 'ERR'>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'fastest' | 'slowest'>('newest');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
  const [detailTab, setDetailTab] = useState<'request' | 'response' | 'headers'>('response');
  const [isCopied, setIsCopied] = useState(false);

  const filteredHistory = useMemo(() => {
    let result = history.filter((item) => {
      const matchesSearch = item.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMethod = selectedMethod === 'ALL' || item.method === selectedMethod;

      let matchesStatus = true;
      if (statusFilter === '2xx') matchesStatus = item.status >= 200 && item.status < 300;
      else if (statusFilter === '3xx') matchesStatus = item.status >= 300 && item.status < 400;
      else if (statusFilter === '4xx') matchesStatus = item.status >= 400 && item.status < 500;
      else if (statusFilter === '5xx') matchesStatus = item.status >= 500 && item.status < 600;
      else if (statusFilter === 'ERR') matchesStatus = item.status === 0 || item.status >= 500;

      return matchesSearch && matchesMethod && matchesStatus;
    });

    if (sortOrder === 'newest') result.sort((a, b) => b.timestamp - a.timestamp);
    else if (sortOrder === 'oldest') result.sort((a, b) => a.timestamp - b.timestamp);
    else if (sortOrder === 'fastest') result.sort((a, b) => a.timeMs - b.timeMs);
    else if (sortOrder === 'slowest') result.sort((a, b) => b.timeMs - a.timeMs);

    return result;
  }, [history, searchQuery, selectedMethod, statusFilter, sortOrder]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status >= 300 && status < 400) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  const handleCopyBody = (body: string) => {
    navigator.clipboard.writeText(body);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            History ({history.length})
          </span>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history URL..."
            className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100/90 text-slate-200 placeholder:text-slate-500 border border-slate-800 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Filter chips & sort */}
        <div className="flex items-center justify-between gap-1 text-[10px]">
          {/* Method filter */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMethod(m)}
                className={`px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                  selectedMethod === m
                    ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Sort selector */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="px-1.5 py-0.5 text-[10px] bg-slate-900 border border-slate-800 rounded text-slate-300 focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="fastest">Fastest</option>
            <option value="slowest">Slowest</option>
          </select>
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1 pt-0.5">
          {(['ALL', '2xx', '3xx', '4xx', '5xx', 'ERR'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-1.5 py-0.2 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                statusFilter === s
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* History Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-600 stroke-1" />
            <p>No request history found</p>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedHistoryItem(item)}
              className="group p-2 rounded-lg bg-slate-900/40 hover:bg-blue-600/15 border border-slate-800/80 hover:border-cyan-500/30 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <div className="flex items-center gap-1.5">
                  <MethodBadge method={item.method} size="sm" />
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded border ${getStatusColor(
                      item.status
                    )}`}
                  >
                    {item.status || 'ERR'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <span>{item.timeMs}ms</span>
                  <span>·</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <div className="text-xs text-slate-300 font-mono truncate group-hover:text-cyan-300 transition-colors">
                {item.url}
              </div>
            </div>
          ))
        )}
      </div>

      {/* History Detail Inspection Modal */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-xl bg-[#121620] border border-blue-500/25 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <MethodBadge method={selectedHistoryItem.method} size="sm" />
                <span
                  className={`font-mono text-xs px-2 py-0.5 rounded border ${getStatusColor(
                    selectedHistoryItem.status
                  )}`}
                >
                  {selectedHistoryItem.status} {selectedHistoryItem.statusText}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedHistoryItem.timeMs}ms
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* URL */}
            <div className="px-5 py-2.5 bg-slate-950/80 border-b border-slate-800 font-mono text-xs text-cyan-300 break-all select-all">
              {selectedHistoryItem.url}
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center px-5 border-b border-slate-800 bg-slate-900/30 text-xs">
              <button
                type="button"
                onClick={() => setDetailTab('response')}
                className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                  detailTab === 'response'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Response Body
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('request')}
                className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                  detailTab === 'request'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Request Payload
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('headers')}
                className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                  detailTab === 'headers'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Headers ({selectedHistoryItem.request.headers?.length || 0})
              </button>
            </div>

            {/* Content view */}
            <div className="flex-1 overflow-y-auto p-4">
              {detailTab === 'response' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Recorded Response</span>
                    {selectedHistoryItem.responseBody && (
                      <button
                        type="button"
                        onClick={() => handleCopyBody(selectedHistoryItem.responseBody!)}
                        className="flex items-center gap-1 text-slate-400 hover:text-cyan-300"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy</span>
                      </button>
                    )}
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                    {selectedHistoryItem.responseBody || 'No body recorded for this response.'}
                  </pre>
                </div>
              )}

              {detailTab === 'request' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">Request Body:</div>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                    {selectedHistoryItem.request.rawBody ||
                      (selectedHistoryItem.request.body?.rawContent?.json
                        ? selectedHistoryItem.request.body.rawContent.json
                        : 'No body sent with request.')}
                  </pre>
                </div>
              )}

              {detailTab === 'headers' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">Sent Request Headers:</div>
                  <div className="rounded-lg border border-slate-800 overflow-hidden text-xs">
                    {(selectedHistoryItem.request.headers || []).map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/60 bg-slate-900/40"
                      >
                        <span className="font-mono text-slate-400">{h.key}</span>
                        <span className="font-mono text-slate-200">{h.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/80 bg-slate-900/50">
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(selectedHistoryItem.timestamp).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    openRequestInTab(selectedHistoryItem.request);
                    setSelectedHistoryItem(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={clearHistory}
        title="Clear Request History"
        message="Are you sure you want to clear all executed request history entries? This cannot be undone."
      />
    </div>
  );
};
