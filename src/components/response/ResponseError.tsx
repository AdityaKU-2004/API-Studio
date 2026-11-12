import React from 'react';
import { AlertCircle, ShieldAlert, Clock, XCircle, WifiOff, HelpCircle } from 'lucide-react';
import { NetworkError } from '../../types';

interface ResponseErrorProps {
  error: NetworkError;
  url: string;
}

export const ResponseError: React.FC<ResponseErrorProps> = ({ error, url }) => {
  const getErrorIcon = () => {
    switch (error.type) {
      case 'cors':
        return <ShieldAlert className="w-8 h-8 text-amber-400" />;
      case 'timeout':
        return <Clock className="w-8 h-8 text-red-400" />;
      case 'abort':
        return <XCircle className="w-8 h-8 text-slate-400" />;
      case 'dns_or_network':
        return <WifiOff className="w-8 h-8 text-red-400" />;
      default:
        return <AlertCircle className="w-8 h-8 text-red-400" />;
    }
  };

  const getBadgeColor = () => {
    switch (error.type) {
      case 'cors':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'timeout':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'abort':
        return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
      default:
        return 'bg-red-500/20 text-red-300 border-red-500/40';
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4 select-text">
      {/* Header Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/20 border border-red-500/30">
        <div className="p-2 rounded-lg bg-red-500/10 shrink-0">{getErrorIcon()}</div>
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${getBadgeColor()}`}
            >
              {error.type.replace('_', ' ')}
            </span>
            <span className="text-xs font-semibold text-slate-200">{error.message}</span>
          </div>
          {error.details && <p className="text-xs text-slate-400 leading-relaxed">{error.details}</p>}
        </div>
      </div>

      {/* Target URL Reference */}
      <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-mono">
        <span className="text-slate-500">Target Endpoint: </span>
        <span className="text-cyan-300 break-all">{url}</span>
      </div>

      {/* Troubleshooting Steps */}
      {error.troubleshooting && error.troubleshooting.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>Troubleshooting Recommendations</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-400 list-disc list-inside">
            {error.troubleshooting.map((tip, idx) => (
              <li key={idx} className="leading-relaxed">
                <span className="text-slate-300">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Architectural Note for Phase 7 */}
      {error.type === 'cors' && (
        <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-500/30 text-[11px] text-blue-300 leading-relaxed">
          <span className="font-semibold text-blue-200">Desktop Architecture Roadmap:</span> When
          running in the browser, CORS restrictions are enforced by the browser's JavaScript sandbox.
          In Phase 7, API Studio will introduce native Tauri 2 / Rust execution, completely bypassing
          browser CORS limitations and unlocking raw socket connections.
        </div>
      )}
    </div>
  );
};
