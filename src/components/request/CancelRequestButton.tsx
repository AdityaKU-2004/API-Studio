import React from 'react';
import { XCircle } from 'lucide-react';
import { useRequestStore } from '../../stores/requestStore';

interface CancelRequestButtonProps {
  tabId?: string;
  className?: string;
}

export const CancelRequestButton: React.FC<CancelRequestButtonProps> = ({ tabId, className = '' }) => {
  const { cancelRequest } = useRequestStore();

  return (
    <button
      type="button"
      onClick={() => cancelRequest(tabId)}
      title="Cancel active HTTP request"
      className={`h-9 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 animate-in fade-in duration-150 ${className}`}
    >
      <XCircle className="w-3.5 h-3.5 text-red-400" />
      <span>Cancel</span>
    </button>
  );
};
