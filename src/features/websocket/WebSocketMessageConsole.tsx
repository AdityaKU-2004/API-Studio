import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Search,
  Copy,
  Check,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { WebSocketMessageDirection, WebSocketMessageEntry } from '../../types';
import { formatBytes } from '../../utils/formatBytes';

interface WebSocketMessageConsoleProps {
  messages: WebSocketMessageEntry[];
  sentCount: number;
  receivedCount: number;
  connectedAt?: number;
  onClear: () => void;
}

const ROW_HEIGHT = 56;
const OVERSCAN = 8;

function formatMaybePrettyJson(payload: string, pretty: boolean): string {
  if (!pretty) return payload;
  const trimmed = payload.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return payload;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return payload;
  }
}

export const WebSocketMessageConsole: React.FC<WebSocketMessageConsoleProps> = ({
  messages,
  sentCount,
  receivedCount,
  connectedAt,
  onClear,
}) => {
  const [directionFilter, setDirectionFilter] = useState<WebSocketMessageDirection | 'all'>('all');
  const [search, setSearch] = useState('');
  const [prettyJson, setPrettyJson] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(320);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (directionFilter !== 'all' && m.direction !== directionFilter) return false;
      if (q && !m.payload.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [messages, directionFilter, search]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const updateSize = () => setViewportHeight(el.clientHeight || 320);
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current && Object.keys(expandedIds).length === 0) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll, expandedIds]);

  const hasExpanded = Object.values(expandedIds).some(Boolean);
  const useVirtual = filtered.length > 80 && !hasExpanded;
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
    a.download = `ws_messages_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#10141d]/90 dark:bg-[#10141d]/90 light:bg-slate-50/90 overflow-hidden">
      {/* Console Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-[#121620]/90 text-xs flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span className="font-sans font-semibold text-slate-200">Message Stream</span>
          <span className="text-emerald-400">↓ {receivedCount}</span>
          <span className="text-cyan-400">↑ {sentCount}</span>
          {connectedAt && (
            <span className="text-slate-500 text-[11px]">
              Connected {new Date(connectedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
            {(['all', 'received', 'sent', 'system'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setDirectionFilter(dir)}
                className={`px-2 py-0.5 rounded text-[11px] capitalize cursor-pointer ${
                  directionFilter === dir
                    ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {dir}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payload..."
              className="pl-6 pr-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-200 w-36 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={prettyJson}
              onChange={(e) => setPrettyJson(e.target.checked)}
            />
            <span>Pretty JSON</span>
          </label>

          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span>Auto-scroll</span>
          </label>

          <button
            type="button"
            onClick={handleDownload}
            disabled={filtered.length === 0}
            title="Download messages JSON"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClear}
            title="Clear message log"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Virtualized / Scrollable Message List */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="flex-1 overflow-y-auto p-2"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-slate-500 py-10">
            Connect to a WebSocket endpoint to send and inspect real-time frames.
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
            {visibleSlice.map((msg) => {
              const isExpanded = !!expandedIds[msg.id];
              const displayPayload = formatMaybePrettyJson(msg.payload, prettyJson);
              const isLong = displayPayload.length > 140 || displayPayload.includes('\n');

              return (
                <div
                  key={msg.id}
                  className={`rounded-lg border px-3 py-2 text-xs font-mono select-text ${
                    msg.direction === 'sent'
                      ? 'bg-cyan-950/20 border-cyan-500/25'
                      : msg.direction === 'received'
                      ? 'bg-emerald-950/20 border-emerald-500/25'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      {msg.direction === 'sent' ? (
                        <span className="text-cyan-300 flex items-center gap-1 font-semibold">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          SENT
                        </span>
                      ) : msg.direction === 'received' ? (
                        <span className="text-emerald-300 flex items-center gap-1 font-semibold">
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          RECV
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1 font-semibold">
                          <Info className="w-3.5 h-3.5" />
                          SYSTEM
                        </span>
                      )}

                      <span className="text-slate-500 uppercase">{msg.format}</span>
                      {msg.sizeBytes > 0 && (
                        <span className="text-slate-500 tabular-nums">
                          {formatBytes(msg.sizeBytes)}
                        </span>
                      )}
                      <span className="text-slate-500 tabular-nums">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isLong && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedIds((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                          }
                          className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, displayPayload)}
                        className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                        title="Copy payload"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <pre
                    className={`text-[11px] text-slate-200 whitespace-pre-wrap break-all ${
                      !isExpanded && isLong ? 'line-clamp-2' : 'max-h-72 overflow-y-auto'
                    }`}
                  >
                    {displayPayload}
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
