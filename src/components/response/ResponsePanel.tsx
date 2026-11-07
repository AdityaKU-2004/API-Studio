import React from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import { ResponseToolbar } from './ResponseToolbar';
import { ResponseBody } from './ResponseBody';
import { ResponseHeaders } from './ResponseHeaders';
import { ResponseCookies } from './ResponseCookies';
import { ResponseTests } from './ResponseTests';
import { ResponseEmptyState } from './ResponseEmptyState';
import { Loader2 } from 'lucide-react';

export const ResponsePanel: React.FC = () => {
  const { activeResponse, isSending } = useRequestStore();
  const { activeResponseTab } = useUiStore();

  return (
    <div className="flex flex-col h-full bg-[#10141d]/90 dark:bg-[#10141d]/90 light:bg-slate-50/90 overflow-hidden relative">
      {/* Loading overlay when simulating send */}
      {isSending && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm space-y-3">
          <div className="relative">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <div className="absolute inset-0 blur-md bg-cyan-400/40 rounded-full animate-pulse" />
          </div>
          <div className="text-xs font-mono text-cyan-300 tracking-wide">
            Simulating network handshake...
          </div>
        </div>
      )}

      {!activeResponse ? (
        <ResponseEmptyState />
      ) : (
        <>
          <ResponseToolbar response={activeResponse} />
          <div className="flex-1 overflow-y-auto">
            {activeResponseTab === 'body' && <ResponseBody response={activeResponse} />}
            {activeResponseTab === 'headers' && <ResponseHeaders headers={activeResponse.headers} />}
            {activeResponseTab === 'cookies' && <ResponseCookies cookies={activeResponse.cookies} />}
            {activeResponseTab === 'tests' && <ResponseTests tests={activeResponse.tests} />}
          </div>
        </>
      )}
    </div>
  );
};
