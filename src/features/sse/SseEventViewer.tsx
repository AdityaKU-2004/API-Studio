import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Pause,
  Play,
  Search,
  Copy,
  Check,
  Download,
  Trash2,
  Radio,
} from 'lucide-react';
import { SseEventEntry } from '../../types';
import { formatBytes } from '../../utils/formatBytes';

interface SseEventViewerProps {
  events: SseEventEntry[];
  totalEventCount: number;
  bufferedCount: number;
  isPaused: boolean;
  connectedAt?: number;
  lastEventId?: string;
  onTogglePause: () => void;
  onClear: () => void;
}

const ROW_HEIGHT = 68;
const OVERSCAN = 8;

export const SseEventViewer: React.FC<SseEventViewerProps> = ({
  events,
  totalEventCount,
  bufferedCount,
  isPaused,
  connectedAt,
  lastEventId,
  onTogglePause,
  onClear,
}) => {
  const [search, setSearch] = useState('');
  const [eventNameFilter, setEventNameFilter] = useState('ALL');
  const [prettyJson, setPrettyJson] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(340);

  const distinctEventNames = useMemo(() => {
    const set = new Set<string>();
    for (const evt of events) {
      set.add(evt.eventName || 'message');
    }
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (eventNameFilter !== 'ALL' && e.eventName !== eventNameFilter) return false;
      if (
        q &&
        !e.data.toLowerCase().includes(q) &&
        !e.eventName.toLowerCase().includes(q) &&
        !(e.eventId || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [events, eventNameFilter, search]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const updateSize = () => setViewportHeight(el.clientHeight || 340);
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const useVirtual = filtered.length > 80;
  const startIdx = useVirtual ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0;
  const endIdx = useVirtual
    ? Math.min(filtered.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
    : filtered.length;
  const visibleSlice = filtered.slice(startIdx, endIdx);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sse_events_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#10141d]/90 dark:bg-[#10141d]/90 light:bg-slate-50/90 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-[#121620]/90 text-xs flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span className="font-sans font-semibold text-slate-200">Live Events</span>
          <span className="text-amber-300">{totalEventCount} total</span>
          {lastEventId && (
            <span className="text-[11px] text-slate-400">Last ID: {lastEventId}</span>
          )}
          {connectedAt && (
            <span className="text-[11px] text-slate-500">
              Started {new Date(connectedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onTogglePause}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
              isPaused
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3 h-3" />
                <span>Resume ({bufferedCount} buffered)</span>
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                <span>Pause Display</span>
              </>
            )}
          </button>

          <select
            value={eventNameFilter}
            onChange={(e) => setEventNameFilter(e.target.value)}
            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300"
          >
            <option value="ALL">All Event Types</option>
            {distinctEventNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event data..."
              className="pl-6 pr-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-200 w-36 focus:outline-none focus:border-amber-400"
            />
          </div>

          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={prettyJson}
              onChange={(e) => setPrettyJson(e.target.checked)}
            />
            <span>Format JSON</span>
          </label>

          <button
            type="button"
            onClick={handleDownload}
            disabled={filtered.length === 0}
            title="Download SSE events JSON"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClear}
            title="Clear event stream"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Event Stream List */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="flex-1 overflow-y-auto p-2"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs py-10 space-y-2">
            <Radio className="w-8 h-8 text-amber-400/30 stroke-1" />
            <span>Connect to an SSE endpoint to stream server-sent events in real time.</span>
          </div>
        ) : (
          <div
            style={
              useVirtual
                ? {
                    paddingTop: `${startIdx * ROW_HEIGHT}px`,
                    paddingBottom: `${(filtered.length - endIdx) * ROW_HEIGHT}px`,
                  }
                : undefined
            }
            className="space-y-1.5"
          >
            {visibleSlice.map((evt) => {
              const displayData =
                prettyJson && evt.parsedJson !== undefined
                  ? JSON.stringify(evt.parsedJson, null, 2)
                  : evt.data;

              return (
                <div
                  key={evt.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-mono select-text"
                >
                  <div className="flex items-center justify-between gap-2 mb-1 text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-amber-300 font-semibold">{evt.eventName}</span>
                      {evt.eventId && (
                        <span className="text-cyan-400">id: {evt.eventId}</span>
                      )}
                      {evt.retryMs !== undefined && (
                        <span className="text-slate-500">retry: {evt.retryMs}ms</span>
                      )}
                      <span className="text-slate-500 tabular-nums">
                        {formatBytes(evt.rawSizeBytes)}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(evt.id, displayData)}
                      className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                      title="Copy event payload"
                    >
                      {copiedId === evt.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <pre className="text-[11px] text-slate-200 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                    {displayData}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
