import React from 'react';
import { Globe, Hexagon, PlugZap, Radio } from 'lucide-react';
import { RequestProtocolType } from '../../types';

interface RequestTypeSelectorProps {
  value: RequestProtocolType;
  onChange: (protocol: RequestProtocolType) => void;
  compact?: boolean;
}

const PROTOCOL_OPTIONS: Array<{
  id: RequestProtocolType;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  activeClass: string;
}> = [
  {
    id: 'http',
    label: 'HTTP / REST',
    shortLabel: 'HTTP',
    icon: <Globe className="w-3.5 h-3.5" />,
    activeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    id: 'graphql',
    label: 'GraphQL',
    shortLabel: 'GraphQL',
    icon: <Hexagon className="w-3.5 h-3.5" />,
    activeClass: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
  },
  {
    id: 'websocket',
    label: 'WebSocket',
    shortLabel: 'WebSocket',
    icon: <PlugZap className="w-3.5 h-3.5" />,
    activeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  {
    id: 'sse',
    label: 'SSE Stream',
    shortLabel: 'SSE',
    icon: <Radio className="w-3.5 h-3.5" />,
    activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
];

export const RequestTypeSelector: React.FC<RequestTypeSelectorProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  return (
    <div
      className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-100 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200"
      role="group"
      aria-label="Request Protocol Type"
    >
      {PROTOCOL_OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
              isActive
                ? opt.activeClass
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 light:text-slate-600 light:hover:text-slate-900'
            }`}
          >
            {opt.icon}
            <span>{compact ? opt.shortLabel : opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
