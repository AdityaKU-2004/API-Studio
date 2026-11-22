import React from 'react';
import { Clock, Info, Activity, ArrowDownToLine, Zap, HardDrive } from 'lucide-react';
import { ApiResponse, RequestTiming } from '../../types';
import { formatDuration } from '../../utils/formatDuration';
import { formatBytes } from '../../utils/formatBytes';
import { analyzeResponseSize } from '../../features/response-analysis/analysisUtils';

interface ResponseTimingProps {
  timing: RequestTiming;
  response?: ApiResponse | null;
}

export const ResponseTiming: React.FC<ResponseTimingProps> = ({ timing, response }) => {
  const total = Math.max(1, timing.duration);
  const sizeBreakdown = response ? analyzeResponseSize(response) : null;

  // Percentages for waterfall bar
  const prepPct = Math.max(2, Math.round((timing.prepareMs / total) * 100));
  const waitPct = Math.max(5, Math.round((timing.waitingMs / total) * 100));
  const downPct = Math.max(2, Math.round((timing.downloadMs / total) * 100));

  const stages = [
    {
      name: 'Request Preparation',
      description: 'Variable substitution, URL parsing, and header/body payload assembly',
      duration: timing.prepareMs,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-400',
      Icon: Zap,
    },
    {
      name: 'Network Latency & Server Processing (TTFB)',
      description: 'Client-measured wait until response headers arrive (includes DNS/TCP/TLS in browser)',
      duration: timing.waitingMs,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-400',
      Icon: Activity,
    },
    {
      name: 'Response Stream Download',
      description: 'Time spent reading response stream bytes into memory',
      duration: timing.downloadMs,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      Icon: ArrowDownToLine,
    },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 select-text">
      {/* Header Stat */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-mono">Total Round-Trip Duration</div>
            <div className="text-xl font-bold font-mono tabular-nums text-cyan-300">
              {formatDuration(timing.duration)}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400 font-mono tabular-nums">
          <div>Started: {new Date(timing.startTime).toLocaleTimeString()}</div>
          <div>Ended: {new Date(timing.endTime).toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Response Size Breakdown */}
      {sizeBreakdown && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span>Response Size Breakdown</span>
            </div>
            {sizeBreakdown.contentEncoding && (
              <span className="text-[11px] font-mono text-cyan-300">
                Content-Encoding: {sizeBreakdown.contentEncoding}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-500">Body Size (Measured)</div>
              <div className="font-mono font-semibold text-slate-200 tabular-nums mt-0.5">
                {formatBytes(sizeBreakdown.bodyBytes)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                {sizeBreakdown.bodyBytes} B
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-500">
                Headers ({Object.keys(response?.headers || {}).length}, {sizeBreakdown.headersMeasurement})
              </div>
              <div className="font-mono font-semibold text-slate-200 tabular-nums mt-0.5">
                ~{formatBytes(sizeBreakdown.exposedHeadersBytes)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                {sizeBreakdown.exposedHeadersBytes} B
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-500">Combined Exposed</div>
              <div className="font-mono font-semibold text-cyan-300 tabular-nums mt-0.5">
                ~{formatBytes(sizeBreakdown.totalExposedBytes)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                {sizeBreakdown.totalExposedBytes} B
              </div>
            </div>
          </div>

          <div className="space-y-0.5 text-[11px] text-slate-500 leading-relaxed">
            {sizeBreakdown.browserNotes.map((n, idx) => (
              <p key={idx}>{n}</p>
            ))}
          </div>
        </div>
      )}

      {/* Waterfall Progress Bar */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>Execution Waterfall</span>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            100% of {timing.duration}ms
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${prepPct}%` }}
            title={`Preparation: ${timing.prepareMs}ms`}
            className="h-full bg-indigo-500 transition-all duration-300"
          />
          <div
            style={{ width: `${waitPct}%` }}
            title={`Waiting (TTFB): ${timing.waitingMs}ms`}
            className="h-full bg-cyan-500 transition-all duration-300"
          />
          <div
            style={{ width: `${downPct}%` }}
            title={`Download: ${timing.downloadMs}ms`}
            className="h-full bg-emerald-500 transition-all duration-300"
          />
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
        <div className="grid grid-cols-12 px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <div className="col-span-8">Phase</div>
          <div className="col-span-4 text-right">Duration</div>
        </div>
        <div className="divide-y divide-slate-800/60">
          {stages.map((stage) => {
            const pct = Math.round((stage.duration / total) * 100);
            return (
              <div
                key={stage.name}
                className="grid grid-cols-12 px-4 py-3 items-center hover:bg-slate-800/20 text-xs"
              >
                <div className="col-span-8 flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${stage.color}`} />
                  <div>
                    <div className="font-medium text-slate-200">{stage.name}</div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      {stage.description}
                    </div>
                  </div>
                </div>
                <div className="col-span-4 text-right font-mono tabular-nums">
                  <span className={`font-semibold ${stage.textColor}`}>
                    {formatDuration(stage.duration)}
                  </span>
                  <span className="text-slate-500 text-[11px] ml-1.5">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Browser Environment Notice */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-300 font-medium">Browser Measurement Accuracy:</span>{' '}
          Fetch API timers only expose client-side Preparation, Time-to-First-Byte (TTFB), and
          Stream Download phases. DNS lookup, TCP handshake, and TLS negotiation breakdown are
          unavailable in browser JS and are not fabricated; native Phase 7 Rust instrumentation will
          supply socket-level timing.
        </div>
      </div>
    </div>
  );
};
