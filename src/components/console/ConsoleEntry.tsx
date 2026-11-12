import React, { useState } from 'react';
import { ConsoleLogEntry } from '../../types';
import { ChevronRight, ChevronDown, CheckCircle, AlertTriangle, AlertCircle, Info, Clock } from 'lucide-react';
import { MethodBadge } from '../common/MethodBadge';

interface ConsoleEntryProps {
  entry: ConsoleLogEntry;
}

export const ConsoleEntry: React.FC<ConsoleEntryProps> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);

  const getLevelBadge = () => {
    switch (entry.level) {
      case 'success':
        return {
          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          Icon: CheckCircle,
        };
      case 'warn':
        return {
          color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          Icon: AlertTriangle,
        };
      case 'error':
        return {
          color: 'bg-red-500/15 text-red-400 border-red-500/30',
          Icon: AlertCircle,
        };
      default:
        return {
          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          Icon: Info,
        };
    }
  };

  const { color, Icon } = getLevelBadge();
  const timeFormatted = new Date(entry.timestamp).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="border-b border-slate-800/60 font-mono text-xs hover:bg-slate-900/40 select-text transition-colors">
      <div
        onClick={() => entry.details && setExpanded(!expanded)}
        className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer ${
          entry.details ? 'hover:text-slate-100' : 'cursor-default'
        }`}
      >
        {entry.details ? (
          <button type="button" className="p-0.5 text-slate-500 mt-0.5">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Timestamp */}
        <span className="text-slate-500 text-[11px] shrink-0">{timeFormatted}</span>

        {/* Level badge */}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold border flex items-center gap-1 shrink-0 ${color}`}
        >
          <Icon className="w-3 h-3" />
          <span>{entry.level}</span>
        </span>

        {/* Method Badge if present */}
        {entry.method && <MethodBadge method={entry.method as any} size="sm" />}

        {/* Title & Message */}
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-200">{entry.title}:</span>
          <span className="text-slate-300 break-all">{entry.message}</span>
        </div>

        {/* Duration badge if present */}
        {entry.durationMs !== undefined && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>{entry.durationMs}ms</span>
          </span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && entry.details && (
        <div className="px-9 pb-3 pt-1 text-[11px] text-slate-400 bg-slate-950/60 font-mono whitespace-pre-wrap border-t border-slate-800/40">
          {entry.details}
        </div>
      )}
    </div>
  );
};
