import React, { useEffect } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { WorkspaceTabs } from './WorkspaceTabs';
import { WorkspaceSplit } from './WorkspaceSplit';
import { SearchDialog } from '../common/SearchDialog';
import { SettingsModal } from '../common/SettingsModal';
import { DocsModal } from '../common/DocsModal';
import { CodeSnippetModal } from '../common/CodeSnippetModal';
import { NewCollectionModal } from '../collections/NewCollectionModal';
import { NewFolderModal } from '../collections/NewFolderModal';
import { NewRequestModal } from '../collections/NewRequestModal';
import { CollectionSettingsModal } from '../collections/CollectionSettingsModal';
import { CollectionRunnerModal } from '../collections/CollectionRunnerModal';
import { CollectionImportExportModal } from '../import-export/CollectionImportExportModal';
import { BackupRestoreModal } from '../backup/BackupRestoreModal';
import { GlobalVariablesModal } from '../environments/GlobalVariablesModal';
import { EnvironmentModal } from '../environments/EnvironmentModal';
import { ExecutionConsole } from '../console/ExecutionConsole';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';

export const AppLayout: React.FC = () => {
  const { sendRequest, saveActiveRequest, addTab, closeTab, activeTabId } = useRequestStore();
  const { theme } = useUiStore();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter: Send request
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendRequest();
      }
      // Ctrl+S or Cmd+S: Save request
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveRequest();
      }
      // Ctrl+Shift+N or Cmd+Shift+N or Ctrl+T: New tab
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault();
        addTab();
      }
      // Ctrl+W or Cmd+W: Close active tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sendRequest, saveActiveRequest, addTab, closeTab, activeTabId]);

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-150 ${
        theme === 'dark'
          ? 'bg-[#0a0d13] text-[#E5E7EB] ambient-glow-dark'
          : 'bg-[#f4f7fb] text-slate-800 ambient-glow-light'
      }`}
    >
      {/* 1. Top Fixed Navigation Bar */}
      <TopBar />

      {/* 2. Main Desktop Workstation Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Resizable Collapsible Sidebar */}
        <Sidebar />

        {/* Center/Right Workspace Area */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Workspace Tabs Header */}
          <WorkspaceTabs />

          {/* Split Request & Response Workspace */}
          <WorkspaceSplit />
        </main>
      </div>

      {/* Modals & Dialogs */}
      <SearchDialog />
      <SettingsModal />
      <DocsModal />
      <CodeSnippetModal />
      <NewCollectionModal />
      <NewFolderModal />
      <NewRequestModal />
      <CollectionSettingsModal />
      <CollectionRunnerModal />
      <CollectionImportExportModal />
      <BackupRestoreModal />
      <GlobalVariablesModal />
      <EnvironmentModal />
      <ExecutionConsole />
    </div>
  );
};
