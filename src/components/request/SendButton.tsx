import React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useRequestStore } from '../../stores/requestStore';
import { CancelRequestButton } from './CancelRequestButton';

interface SendButtonProps {
  className?: string;
}

export const SendButton: React.FC<SendButtonProps> = ({ className = '' }) => {
  const { sendRequest, isSending, activeTabId } = useRequestStore();

  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      {isSending ? (
        <>
          <button
            type="button"
            disabled
            className="h-9 px-4 rounded-lg bg-cyan-600/30 border border-cyan-500/50 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.25)] cursor-not-allowed select-none"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>Sending...</span>
          </button>
          <CancelRequestButton tabId={activeTabId} />
        </>
      ) : (
        <button
          type="button"
          onClick={() => sendRequest()}
          title="Send HTTP Request (Ctrl+Enter)"
          className="h-9 px-4 rounded-lg bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_16px_rgba(6,182,212,0.35)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] hover:brightness-110 active:brightness-95 transition-all cursor-pointer"
        >
          <span>Send</span>
          <Send className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
