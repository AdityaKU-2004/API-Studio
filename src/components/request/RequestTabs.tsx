import React from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';

export const RequestTabs: React.FC = () => {
  const { activeRequestTab, setActiveRequestTab } = useUiStore();
  const { tabs, activeTabId } = useRequestStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const enabledParamsCount = request?.params.filter((p) => p.enabled && p.key).length || 0;
  const enabledHeadersCount = request?.headers.filter((h) => h.enabled && h.key).length || 0;
  const authType = request?.auth.type;
  const hasAuth = authType && authType !== 'none';
  const hasBody = request?.bodyType && request.bodyType !== 'none';

  const tabItems: {
    id: typeof activeRequestTab;
    label: string;
    badge?: number | string;
  }[] = [
    { id: 'params', label: 'Params', badge: enabledParamsCount > 0 ? enabledParamsCount : undefined },
    { id: 'headers', label: 'Headers', badge: enabledHeadersCount > 0 ? enabledHeadersCount : undefined },
    { id: 'auth', label: 'Authorization', badge: hasAuth ? authType?.toUpperCase() : undefined },
    { id: 'body', label: 'Body', badge: hasBody ? request?.bodyType?.toUpperCase() : undefined },
    { id: 'scripts', label: 'Scripts' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 text-xs select-none px-2 overflow-x-auto">
      {tabItems.map((tab) => {
        const isActive = activeRequestTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveRequestTab(tab.id)}
            className={`relative py-2 px-3 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              isActive
                ? 'text-cyan-400 dark:text-cyan-400 light:text-blue-600 font-semibold'
                : 'text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 light:hover:text-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-cyan-300 font-mono">
                {tab.badge}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};
