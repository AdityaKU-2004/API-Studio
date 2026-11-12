import React, { useState, useMemo } from 'react';
import {
  Terminal,
  Trash2,
  X,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useExecutionStore } from '../../stores/executionStore';
import { ConsoleLogLevel } from '../../types';
import { ConsoleEntry } from './ConsoleEntry';

export const ExecutionConsole: React.FC = () => {
  const { logs, clearLogs, isConsoleOpen, setConsoleOpen } = useExecutionStore();
  const [filterLevel, setFilterLevel] = useState<ConsoleLogLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel !== 'all' && log.level !== filterLevel) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesMsg = log.message.toLowerCase().includes(q);
        const matchesTitle = log.title.toLowerCase().includes(q);
        const matchesUrl = log.url?.toLowerCase().includes(q);
        return matchesMsg || matchesTitle || matchesUrl;
      }
      return true;
    });
  }, [logs, filterLevel, search]);

  if (!isConsoleOpen) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 bg-[#0e121a]/95 backdrop-blur-md border-t border-slate-700/80 shadow-2xl flex flex-col transition-all duration-200 select-none ${
        isMinimized ? 'h-9' : 'h-64'
      }`}
    >
      {/* Console Header Bar */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-slate-800 bg-[#121620] shrink-0 text-xs">
        {/* Left: Title + Entry Count */}
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">Execution Console</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-cyan-300 font-mono">
            {logs.length}
          </span>
        </div>

        {/* Center: Filters & Search (only visible when not minimized) */}
        {!isMinimized && (
          <div className="flex items-center gap-2">
            {/* Level Filters */}
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'info', label: 'Info', Icon: Info },
                  { id: 'warn', label: 'Warnings', Icon: AlertTriangle },
                  { id: 'error', label: 'Errors', Icon: AlertCircle },
                ] as const
              ).map((tab) => {
                const isActive = filterLevel === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterLevel(tab.id)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/30 text-cyan-300 font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-400 absolute left-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter logs..."
                className="h-6 pl-6 pr-2 rounded bg-slate-900 text-slate-200 placeholder:text-slate-500 font-mono text-[11px] border border-slate-800 focus:outline-none focus:border-cyan-400 w-36"
              />
            </div>
          </div>
        )}

        {/* Right: Actions (Clear, Minimize, Close) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearLogs}
            title="Clear Console"
            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand Console' : 'Minimize Console'}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setConsoleOpen(false)}
            title="Close Console"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Entries Container */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-500 text-xs">
              <Terminal className="w-6 h-6 mb-2 opacity-40 text-slate-400" />
              <span>{logs.length === 0 ? 'No execution logs recorded yet. Send a request to begin logging.' : 'No logs match the current filter.'}</span>
            </div>
          ) : (
            filteredLogs.map((log) => <ConsoleEntry key={log.id} entry={log} />)
          )}
        </div>
      )}
    </div>
  );
};
