import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  MoreVertical,
  Copy,
  FolderMinus,
  Edit2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useRequestStore } from '../../stores/requestStore';
import { useExecutionStore } from '../../stores/executionStore';
import { MethodBadge } from '../common/MethodBadge';
import { Modal } from '../common/Modal';

export const WorkspaceTabs: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    duplicateTab,
    renameTab,
    addTab,
    saveActiveRequest,
    pendingCloseTabId,
    setPendingCloseTabId,
  } = useRequestStore();

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    tabId: string;
    x: number;
    y: number;
  }>({
    isOpen: false,
    tabId: '',
    x: 0,
    y: 0,
  });

  const [isRenamingTabId, setIsRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };
    if (contextMenu.isOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [contextMenu.isOpen]);

  // Focus rename input
  useEffect(() => {
    if (isRenamingTabId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenamingTabId]);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      tabId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleStartRename = (tabId: string, currentTitle: string) => {
    setIsRenamingTabId(tabId);
    setRenameValue(currentTitle);
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRenamingTabId && renameValue.trim()) {
      renameTab(isRenamingTabId, renameValue.trim());
    }
    setIsRenamingTabId(null);
  };

  const pendingTab = tabs.find((t) => t.id === pendingCloseTabId);

  return (
    <div className="h-10 w-full flex items-center bg-[#0d1017]/90 dark:bg-[#0d1017]/90 light:bg-slate-100/80 border-b border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 px-2 gap-1 overflow-x-auto select-none shrink-0 z-10">
      <div className="flex items-center gap-1 min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isRenaming = isRenamingTabId === tab.id;
          const tabExec = useExecutionStore.getState().tabExecutions[tab.id];
          const isTabRunning = tabExec?.status === 'sending' || tabExec?.status === 'receiving';

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer transition-all border-t border-l border-r ${
                isActive
                  ? 'bg-[#151a24] dark:bg-[#151a24] light:bg-white text-slate-100 dark:text-slate-100 light:text-slate-900 border-blue-500/40 dark:border-blue-500/40 light:border-blue-300 shadow-[0_-2px_10px_rgba(6,182,212,0.1)] font-medium -mb-[1px] z-10'
                  : 'bg-transparent text-slate-400 dark:text-slate-400 light:text-slate-600 border-transparent hover:bg-slate-800/40 dark:hover:bg-slate-800/40 light:hover:bg-slate-200/50'
              }`}
            >
              {isTabRunning ? (
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
              ) : (
                <MethodBadge method={tab.method} size="sm" />
              )}

              {isRenaming ? (
                <form onSubmit={handleSaveRename} onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => setIsRenamingTabId(null)}
                    className="w-24 px-1 py-0.5 rounded bg-slate-900 border border-cyan-400 text-xs text-white focus:outline-none"
                  />
                </form>
              ) : (
                <span
                  className="truncate max-w-[140px] text-xs"
                  title={tab.title}
                  onDoubleClick={() => handleStartRename(tab.id, tab.title)}
                >
                  {tab.title}
                </span>
              )}

              {/* Unsaved dirty dot indicator */}
              {tab.isDirty && (
                <span
                  title="Unsaved changes"
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400 dark:bg-cyan-400 light:bg-blue-600 shadow-[0_0_6px_rgba(6,182,212,0.8)]"
                />
              )}

              {/* Close Tab Button */}
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
        title="Add new request tab (Ctrl+T or Ctrl+Shift+N)"
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 dark:hover:bg-slate-800/50 light:hover:bg-slate-200/80 transition-colors cursor-pointer shrink-0 ml-1"
      >
        <Plus className="w-4 h-4 text-cyan-400" />
      </button>

      {/* Tab Context Menu */}
      {contextMenu.isOpen && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed w-44 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 border border-blue-500/25 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-slate-200"
        >
          <button
            type="button"
            onClick={() => {
              const target = tabs.find((t) => t.id === contextMenu.tabId);
              if (target) handleStartRename(target.id, target.title);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue-600/20 cursor-pointer text-left"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Rename Tab</span>
          </button>

          <button
            type="button"
            onClick={() => {
              duplicateTab(contextMenu.tabId);
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue-600/20 cursor-pointer text-left"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            <span>Duplicate Tab</span>
          </button>

          <div className="border-t border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 my-1" />

          <button
            type="button"
            onClick={() => {
              closeTab(contextMenu.tabId);
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue-600/20 cursor-pointer text-left"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span>Close Tab</span>
          </button>

          <button
            type="button"
            onClick={() => {
              closeOtherTabs(contextMenu.tabId);
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            disabled={tabs.length <= 1}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue-600/20 cursor-pointer text-left disabled:opacity-40"
          >
            <FolderMinus className="w-3.5 h-3.5 text-slate-400" />
            <span>Close Other Tabs</span>
          </button>

          <button
            type="button"
            onClick={() => {
              closeAllTabs();
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/20 text-red-400 cursor-pointer text-left"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close All Tabs</span>
          </button>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      <Modal
        isOpen={pendingCloseTabId !== null}
        onClose={() => setPendingCloseTabId(null)}
        title="Unsaved Changes"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="leading-relaxed pt-1">
              You have unsaved changes in &ldquo;{pendingTab?.title}&rdquo;. Do you want to save your
              modifications before closing?
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPendingCloseTabId(null)}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingCloseTabId) closeTab(pendingCloseTabId, true);
              }}
              className="px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={() => {
                saveActiveRequest();
                if (pendingCloseTabId) closeTab(pendingCloseTabId, true);
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer"
            >
              Save & Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
