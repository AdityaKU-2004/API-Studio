import React from 'react';
import { HttpMethod } from '../../types';

interface MethodBadgeProps {
  method: HttpMethod;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const methodStyles: Record<HttpMethod, { text: string; bg: string; border: string }> = {
  GET: {
    text: 'text-emerald-400 dark:text-emerald-400 light:text-emerald-700',
    bg: 'bg-emerald-500/15 dark:bg-emerald-500/15 light:bg-emerald-50',
    border: 'border-emerald-500/30 dark:border-emerald-500/30 light:border-emerald-300',
  },
  POST: {
    text: 'text-orange-400 dark:text-orange-400 light:text-orange-700',
    bg: 'bg-orange-500/15 dark:bg-orange-500/15 light:bg-orange-50',
    border: 'border-orange-500/30 dark:border-orange-500/30 light:border-orange-300',
  },
  PUT: {
    text: 'text-blue-400 dark:text-blue-400 light:text-blue-700',
    bg: 'bg-blue-500/15 dark:bg-blue-500/15 light:bg-blue-50',
    border: 'border-blue-500/30 dark:border-blue-500/30 light:border-blue-300',
  },
  PATCH: {
    text: 'text-purple-400 dark:text-purple-400 light:text-purple-700',
    bg: 'bg-purple-500/15 dark:bg-purple-500/15 light:bg-purple-50',
    border: 'border-purple-500/30 dark:border-purple-500/30 light:border-purple-300',
  },
  DELETE: {
    text: 'text-red-400 dark:text-red-400 light:text-red-700',
    bg: 'bg-red-500/15 dark:bg-red-500/15 light:bg-red-50',
    border: 'border-red-500/30 dark:border-red-500/30 light:border-red-300',
  },
  HEAD: {
    text: 'text-cyan-400 dark:text-cyan-400 light:text-cyan-700',
    bg: 'bg-cyan-500/15 dark:bg-cyan-500/15 light:bg-cyan-50',
    border: 'border-cyan-500/30 dark:border-cyan-500/30 light:border-cyan-300',
  },
  OPTIONS: {
    text: 'text-slate-400 dark:text-slate-400 light:text-slate-700',
    bg: 'bg-slate-500/15 dark:bg-slate-500/15 light:bg-slate-100',
    border: 'border-slate-500/30 dark:border-slate-500/30 light:border-slate-300',
  },
};

export const MethodBadge: React.FC<MethodBadgeProps> = ({ method, size = 'sm', className = '' }) => {
  const style = methodStyles[method] || methodStyles.GET;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 tracking-wider',
    md: 'text-xs px-2 py-0.5 tracking-wider',
    lg: 'text-sm px-3 py-1 tracking-wider',
  }[size];

  return (
    <span
      className={`font-mono font-semibold rounded border inline-flex items-center justify-center shrink-0 uppercase select-none ${style.text} ${style.bg} ${style.border} ${sizeClasses} ${className}`}
    >
      {method}
    </span>
  );
};
