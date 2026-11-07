import React, { useState, useMemo } from 'react';
import { Search, Trash2, ArrowRight, Clock, ExternalLink } from 'lucide-react';
import { useHistoryStore } from '../../stores/historyStore';
import { useRequestStore } from '../../stores/requestStore';
import { MethodBadge } from '../common/MethodBadge';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { HttpMethod } from '../../types';

interface HistoryPageProps {
  isSidebarView?: boolean;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ isSidebarView = false }) => {
  const { history, clearHistory, deleteHistoryItem } = useHistoryStore();
  const { openRequestInTab } = useRequestStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch = item.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMethod = selectedMethod === 'ALL' || item.method === selectedMethod;
      return matchesSearch && matchesMethod;
    });
  }, [history, searchQuery, selectedMethod]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status >= 300 && status < 400) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            History ({history.length})
          </span>
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

        {/* Method filter chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMethod(m)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${
                selectedMethod === m
                  ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {m}
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
              onClick={() => openRequestInTab(item.request)}
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
                    {item.status}
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
