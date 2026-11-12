import React from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useExecutionStore } from '../../stores/executionStore';
import { useUiStore } from '../../stores/uiStore';
import { ResponseToolbar } from './ResponseToolbar';
import { ResponseBody } from './ResponseBody';
import { ResponseHeaders } from './ResponseHeaders';
import { ResponseCookies } from './ResponseCookies';
import { ResponseTests } from './ResponseTests';
import { ResponseTiming } from './ResponseTiming';
import { ResponseEmptyState } from './ResponseEmptyState';
import { CancelRequestButton } from '../request/CancelRequestButton';
import { Loader2 } from 'lucide-react';

export const ResponsePanel: React.FC = () => {
  const { activeResponse, isSending, activeTabId } = useRequestStore();
  const { activeResponseTab } = useUiStore();
  const { tabExecutions } = useExecutionStore();

  const currentTabExec = tabExecutions[activeTabId];
  const progressText = currentTabExec?.progressMessage || 'Sending HTTP request...';

  return (
    <div className="flex flex-col h-full bg-[#10141d]/90 dark:bg-[#10141d]/90 light:bg-slate-50/90 overflow-hidden relative">
      {/* Loading overlay when sending HTTP request */}
      {isSending && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm space-y-4">
          <div className="relative">
            <Loader2 className="w-9 h-9 text-cyan-400 animate-spin" />
            <div className="absolute inset-0 blur-md bg-cyan-400/40 rounded-full animate-pulse" />
          </div>
          <div className="space-y-1 text-center">
            <div className="text-xs font-mono text-cyan-300 tracking-wide font-medium">
              {progressText}
            </div>
            <div className="text-[11px] text-slate-400">
              Awaiting remote server handshake and response stream
            </div>
          </div>
          <CancelRequestButton tabId={activeTabId} />
        </div>
      )}

      {!activeResponse ? (
        <ResponseEmptyState />
      ) : (
        <>
          <ResponseToolbar response={activeResponse} />
          <div className="flex-1 overflow-y-auto">
            {activeResponseTab === 'body' && <ResponseBody response={activeResponse} />}
            {activeResponseTab === 'headers' && (
              <ResponseHeaders headers={activeResponse.headers || {}} />
            )}
            {activeResponseTab === 'cookies' && (
              <ResponseCookies cookies={activeResponse.cookies || []} />
            )}
            {activeResponseTab === 'tests' && (
              <ResponseTests tests={activeResponse.tests || []} />
            )}
            {activeResponseTab === 'timing' && (
              <ResponseTiming
                timing={
                  activeResponse.timing || {
                    startTime: activeResponse.timestamp,
                    endTime: activeResponse.timestamp + activeResponse.timeMs,
                    duration: activeResponse.timeMs,
                    prepareMs: 2,
                    waitingMs: Math.max(1, activeResponse.timeMs - 5),
                    downloadMs: 3,
                  }
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};
