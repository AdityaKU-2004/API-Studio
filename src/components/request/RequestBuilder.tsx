import React from 'react';
import { UrlBar } from './UrlBar';
import { RequestTabs } from './RequestTabs';
import { ParamsEditor } from './params/ParamsEditor';
import { HeadersEditor } from './headers/HeadersEditor';
import { AuthorizationEditor } from './auth/AuthorizationEditor';
import { BodyEditor } from './body/BodyEditor';
import { ScriptsEditor } from './scripts/ScriptsEditor';
import { RequestSettings } from './settings/RequestSettings';
import { RequestValidatorBanner } from './validation/RequestValidatorBanner';
import { VariablePreviewBanner } from '../common/VariablePreviewBanner';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';

export const RequestBuilder: React.FC = () => {
  const { activeRequestTab } = useUiStore();
  const { tabs, activeTabId } = useRequestStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  return (
    <div className="flex flex-col h-full bg-[#11151e]/80 dark:bg-[#11151e]/80 light:bg-white/80 overflow-hidden select-none">
      {/* Top URL Bar Area */}
      <div className="p-3 border-b border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 shrink-0">
        <UrlBar />
      </div>

      {/* Undefined Variables Warning Banner */}
      <VariablePreviewBanner />

      {/* Validation Notice Banner (if any issues found) */}
      {request && <RequestValidatorBanner request={request} />}

      {/* Request Subtabs Bar */}
      <RequestTabs />

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeRequestTab === 'params' && <ParamsEditor />}
        {activeRequestTab === 'headers' && <HeadersEditor />}
        {activeRequestTab === 'auth' && <AuthorizationEditor />}
        {activeRequestTab === 'body' && <BodyEditor />}
        {activeRequestTab === 'scripts' && <ScriptsEditor />}
        {activeRequestTab === 'settings' && <RequestSettings />}
      </div>
    </div>
  );
};
