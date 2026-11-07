import React from 'react';
import { Plus, X, Globe } from 'lucide-react';
import { useRequestStore } from '../../stores/requestStore';
import { MethodBadge } from '../common/MethodBadge';

export const WorkspaceTabs: React.FC = () => {
  const { tabs, activeTabId, setActiveTabId, closeTab, addTab } = useRequestStore();

  return (
    <div className="h-10 w-full flex items-center bg-[#0d1017]/90 dark:bg-[#0d1017]/90 light:bg-slate-100/80 border-b border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 px-2 gap-1 overflow-x-auto select-none shrink-0 z-10">
      <div className="flex items-center gap-1 min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer transition-all border-t border-l border-r ${
                isActive
                  ? 'bg-[#151a24] dark:bg-[#151a24] light:bg-white text-slate-100 dark:text-slate-100 light:text-slate-900 border-blue-500/40 dark:border-blue-500/40 light:border-blue-300 shadow-[0_-2px_10px_rgba(6,182,212,0.1)] font-medium -mb-[1px] z-10'
                  : 'bg-transparent text-slate-400 dark:text-slate-400 light:text-slate-600 border-transparent hover:bg-slate-800/40 dark:hover:bg-slate-800/40 light:hover:bg-slate-200/50'
              }`}
            >
              <MethodBadge method={tab.method} size="sm" />

              <span className="truncate max-w-[140px] text-xs" title={tab.title}>
                {tab.title}
              </span>

              {tab.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dark:bg-cyan-400 light:bg-blue-600 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title="Close tab (Ctrl+W)"
                className="p-0.5 rounded hover:bg-slate-700/60 dark:hover:bg-slate-700/60 light:hover:bg-slate-200 text-slate-400 hover:text-slate-200 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>

              {isActive && (
                <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Request Tab Button */}
      <button
        type="button"
        onClick={() => addTab()}
        title="Add new request tab (Ctrl+T)"
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 dark:hover:bg-slate-800/50 light:hover:bg-slate-200/80 transition-colors cursor-pointer shrink-0 ml-1"
      >
        <Plus className="w-4 h-4 text-cyan-400" />
      </button>
    </div>
  );
};
