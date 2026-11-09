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
  const [highlightedIndex, setHighlightedIndex] = useState(methods.indexOf(method));
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHighlightedIndex(methods.indexOf(method));
  }, [method]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % methods.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + methods.length) % methods.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onChange(methods[highlightedIndex]);
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="h-9 px-3 rounded-l-lg bg-[#151a24] dark:bg-[#151a24] light:bg-slate-100 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 hover:border-cyan-500/50 flex items-center gap-2 transition-colors cursor-pointer select-none"
      >
        <MethodBadge method={method} size="sm" />
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 w-36 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 border border-blue-500/25 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {methods.map((m, idx) => {
            const isHighlighted = idx === highlightedIndex;
            const isSelected = m === method;
            return (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(m);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                  isHighlighted ? 'bg-blue-600/20' : 'hover:bg-slate-800/40'
                }`}
              >
                <MethodBadge method={m} size="sm" />
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
