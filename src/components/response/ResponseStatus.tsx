import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface ResponseStatusProps {
  status: number;
  statusText: string;
  isError?: boolean;
}

export const ResponseStatus: React.FC<ResponseStatusProps> = ({
  status,
  statusText,
  isError = false,
}) => {
  if (status === 0 || isError) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-red-500/40 bg-red-500/15 text-red-400 font-mono text-xs font-semibold shadow-sm">
        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span>Error:</span>
        <span className="truncate max-w-[200px]">{statusText || 'Network Error'}</span>
      </div>
    );
  }

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) {
      return {
        badge: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
        Icon: CheckCircle2,
      };
    }
    if (code >= 300 && code < 400) {
      return {
        badge: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
        Icon: Info,
      };
    }
    if (code >= 400 && code < 500) {
      return {
        badge: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
        Icon: AlertTriangle,
      };
    }
    return {
      badge: 'text-red-400 bg-red-500/15 border-red-500/30',
      Icon: XCircle,
    };
  };

  const { badge, Icon } = getStatusColor(status);

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-mono text-xs font-semibold ${badge} shadow-sm`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
      <span>{statusText}</span>
    </div>
  );
};
