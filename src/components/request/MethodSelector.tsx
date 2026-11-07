import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { HttpMethod } from '../../types';
import { MethodBadge } from '../common/MethodBadge';

interface MethodSelectorProps {
  method: HttpMethod;
  onChange: (method: HttpMethod) => void;
}

const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export const MethodSelector: React.FC<MethodSelectorProps> = ({ method, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-3 rounded-l-lg bg-[#151a24] dark:bg-[#151a24] light:bg-slate-100 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 hover:border-cyan-500/50 flex items-center gap-2 transition-colors cursor-pointer select-none"
      >
        <MethodBadge method={method} size="sm" />
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-32 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 border border-blue-500/25 shadow-2xl py-1 z-50">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onChange(m);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-blue-600/20 text-left transition-colors cursor-pointer"
            >
              <MethodBadge method={m} size="sm" />
              {m === method && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
