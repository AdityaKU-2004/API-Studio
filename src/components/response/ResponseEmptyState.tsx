import React from 'react';
import { Send, Terminal, Zap } from 'lucide-react';
import { useRequestStore } from '../../stores/requestStore';

export const ResponseEmptyState: React.FC = () => {
  const { sendRequest, isSending } = useRequestStore();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none space-y-4">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_24px_rgba(6,182,212,0.15)]">
          <Terminal className="w-7 h-7 text-cyan-400 stroke-1" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-400/20 border border-cyan-400 flex items-center justify-center">
          <Zap className="w-2.5 h-2.5 text-cyan-300" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h4 className="text-sm font-semibold text-slate-200">
          No Response Yet
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          Configure your request parameters, headers, or body above, then click Send to simulate network execution.
        </p>
      </div>

      <button
        type="button"
        onClick={() => sendRequest()}
        disabled={isSending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold hover:brightness-110 active:brightness-95 transition-all shadow-[0_0_16px_rgba(6,182,212,0.3)] cursor-pointer"
      >
        <Send className="w-3.5 h-3.5" />
        <span>Send Request</span>
        <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono font-normal">
          Ctrl+Enter
        </kbd>
      </button>
    </div>
  );
};
