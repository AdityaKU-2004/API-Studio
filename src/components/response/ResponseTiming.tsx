import React from 'react';
import { Clock, Info, Activity, ArrowDownToLine, Zap } from 'lucide-react';
import { RequestTiming } from '../../types';
import { formatDuration } from '../../utils/formatDuration';

interface ResponseTimingProps {
  timing: RequestTiming;
}

export const ResponseTiming: React.FC<ResponseTimingProps> = ({ timing }) => {
  const total = Math.max(1, timing.duration);

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
      description: 'Network travel time plus remote server processing until first byte received',
      duration: timing.waitingMs,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-400',
      Icon: Activity,
    },
    {
      name: 'Response Stream Download',
      description: 'Time spent streaming and reading response body chunks into memory',
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
            <div className="text-xl font-bold font-mono text-cyan-300">
              {formatDuration(timing.duration)}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400 font-mono">
          <div>Started: {new Date(timing.startTime).toLocaleTimeString()}</div>
          <div>Ended: {new Date(timing.endTime).toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Waterfall Progress Bar */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>Execution Waterfall</span>
          <span className="text-[11px] font-mono text-slate-500">100% of {timing.duration}ms</span>
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
                <div className="col-span-4 text-right font-mono">
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
          In browser environments, client-side HTTP measurements represent client timings (Preparation,
          Time to First Byte, and Stream Download). Granular DNS resolution, TCP handshakes, and TLS
          negotiation metrics will be provided in Phase 7 via native desktop Rust socket profiling.
        </div>
      </div>
    </div>
  );
};
