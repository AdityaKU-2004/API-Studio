import React from 'react';
import { UrlBar } from './UrlBar';
import { RequestTabs } from './RequestTabs';
import { ParamsEditor } from './ParamsEditor';
import { HeadersEditor } from './HeadersEditor';
import { AuthorizationEditor } from './AuthorizationEditor';
import { BodyEditor } from './BodyEditor';
import { ScriptsEditor } from './ScriptsEditor';
import { RequestSettings } from './RequestSettings';
import { useUiStore } from '../../stores/uiStore';

export const RequestBuilder: React.FC = () => {
  const { activeRequestTab } = useUiStore();

  return (
    <div className="flex flex-col h-full bg-[#11151e]/80 dark:bg-[#11151e]/80 light:bg-white/80 overflow-hidden select-none">
      {/* Top URL Bar Area */}
      <div className="p-3 border-b border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 shrink-0">
        <UrlBar />
      </div>

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
