import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { RequestDiagnosticItem } from '../../types';

interface DiagnosticsPanelProps {
  diagnostics: RequestDiagnosticItem[];
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ diagnostics }) => {
  if (diagnostics.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {diagnostics.map((item) => {
        const style =
          item.severity === 'error'
            ? {
                box: 'bg-red-950/25 border-red-500/30',
                icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
                title: 'text-red-300',
              }
            : item.severity === 'warning'
            ? {
                box: 'bg-amber-950/25 border-amber-500/30',
                icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
                title: 'text-amber-300',
              }
            : {
                box: 'bg-blue-950/25 border-blue-500/30',
                icon: <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />,
                title: 'text-cyan-300',
              };

        return (
          <div key={item.id} className={`p-3 rounded-xl border ${style.box} space-y-1.5 text-xs`}>
            <div className="flex items-start gap-2">
              {style.icon}
              <div className="min-w-0 flex-1">
                <div className={`font-semibold ${style.title}`}>{item.title}</div>
                <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{item.message}</p>
              </div>
            </div>
            {item.suggestions.length > 0 && (
              <ul className="pl-6 space-y-1 text-[11px] text-slate-400 list-disc">
                {item.suggestions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};
