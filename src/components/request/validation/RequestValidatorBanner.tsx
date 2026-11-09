import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { ValidationError, ApiRequest } from '../../../types';
import { validateRequest } from '../../../services/request/requestValidator';

interface RequestValidatorBannerProps {
  request: ApiRequest;
}

export const RequestValidatorBanner: React.FC<RequestValidatorBannerProps> = ({ request }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const errors = validateRequest(request);

  if (errors.length === 0) return null;

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;

  return (
    <div className="mx-3 my-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs overflow-hidden select-none">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-amber-500/15 transition-colors"
      >
        <div className="flex items-center gap-2">
          {errorCount > 0 ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
          <span className="font-medium text-amber-300">
            Request Validation Notice:
          </span>
          <span className="text-[11px] text-slate-300">
            {errorCount > 0 && `${errorCount} error${errorCount > 1 ? 's' : ''}`}
            {errorCount > 0 && warningCount > 0 && ', '}
            {warningCount > 0 && `${warningCount} warning${warningCount > 1 ? 's' : ''}`}
          </span>
        </div>

        <button
          type="button"
          className="text-slate-400 hover:text-slate-200"
          title={isExpanded ? 'Collapse validation details' : 'Expand validation details'}
        >
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-2 pt-1 border-t border-amber-500/20 space-y-1">
          {errors.map((err, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300">
              <span
                className={`font-mono text-[9px] px-1 rounded uppercase font-semibold shrink-0 mt-0.5 ${
                  err.severity === 'error'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {err.field}
              </span>
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
