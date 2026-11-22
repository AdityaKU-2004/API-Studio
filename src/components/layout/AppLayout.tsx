import React, { useEffect } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { WorkspaceTabs } from './WorkspaceTabs';
import { WorkspaceSplit } from './WorkspaceSplit';
import { CollectionRunner } from '../runner/CollectionRunner';
import { TestSuiteManager } from '../suites/TestSuiteManager';
import { TestReports } from '../reports/TestReports';
import { ScriptTemplates } from '../scripting/ScriptTemplates';
import { SchemaValidator } from '../testing/SchemaValidator';
import { ResponseComparisonWorkspace } from '../../features/comparison/ResponseComparisonWorkspace';
import { DeveloperToolsDashboard } from '../../features/developer-tools/DeveloperToolsDashboard';
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
import { useAppStore } from '../../stores/appStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useVariableStore } from '../../stores/variableStore';
import { useHistoryStore } from '../../stores/historyStore';
import { useScriptingStore } from '../../stores/scriptingStore';
import { useTestingStore } from '../../stores/testingStore';
import { useTestSuiteStore } from '../../stores/testSuiteStore';
import { useReportStore } from '../../stores/reportStore';
import { useComparisonStore } from '../../stores/comparisonStore';
import { useDeveloperToolsStore } from '../../stores/developerToolsStore';
import { useWebSocketStore } from '../../stores/websocketStore';
import { storageService } from '../../services/storage/storageService';

export const AppLayout: React.FC = () => {
  const { sendRequest, saveActiveRequest, addTab, closeTab, activeTabId } = useRequestStore();
  const { theme } = useUiStore();
  const { activeView } = useAppStore();

  // Initialize IndexedDB storage and hydrate all persistent stores on boot
  useEffect(() => {
    const bootstrapStorage = async () => {
      await storageService.init();
      await Promise.all([
        useCollectionStore.getState().loadCollections(),
        useEnvironmentStore.getState().loadEnvironments(),
        useVariableStore.getState().loadGlobalVariables(),
        useHistoryStore.getState().loadHistory(),
        useScriptingStore.getState().loadTemplates(),
        useTestingStore.getState().loadTestingData(),
        useTestSuiteStore.getState().loadSuites(),
        useReportStore.getState().loadReports(),
        useComparisonStore.getState().loadSavedSessions(),
        useDeveloperToolsStore.getState().loadPreferences(),
        useWebSocketStore.getState().loadTemplates(),
      ]);
    };
    bootstrapStorage();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendRequest();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveRequest();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') ||
        ((e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === 't' &&
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))
      ) {
        e.preventDefault();
        addTab();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sendRequest, saveActiveRequest, addTab, closeTab, activeTabId]);

  const renderMainContent = () => {
    if (activeView === 'runner') return <CollectionRunner />;
    if (activeView === 'suites') return <TestSuiteManager />;
    if (activeView === 'reports') return <TestReports />;
    if (activeView === 'templates') return <ScriptTemplates />;
    if (activeView === 'schemas') return <SchemaValidator mode="library" />;
    if (activeView === 'comparison') return <ResponseComparisonWorkspace />;
    if (activeView === 'devtools') return <DeveloperToolsDashboard />;

    return (
      <>
        <WorkspaceTabs />
        <WorkspaceSplit />
      </>
    );
  };

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
          {renderMainContent()}
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
