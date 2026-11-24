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
import { ApiExplorerView } from '../../features/openapi/ApiExplorerView';
import { SpecEditorView } from '../../features/openapi/SpecEditorView';
import { ApiDocsView } from '../../features/documentation/ApiDocsView';
import { ApiVersionsView } from '../../features/openapi/ApiVersionsView';
import { MockServerView } from '../../features/mocking/MockServerView';
import { ContractTestingView } from '../../features/contract/ContractTestingView';
import { GitWorkspaceView } from '../../features/git/GitWorkspaceView';
import { WorkspaceDashboard } from '../../features/workspaces/WorkspaceDashboard';
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
import { SqliteMigrationModal } from '../migration/SqliteMigrationModal';
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
import { useDesktopStore } from '../../stores/desktopStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useSpecStore } from '../../stores/specStore';
import { useMockStore } from '../../stores/mockStore';
import { useContractStore } from '../../stores/contractStore';
import { useGitStore } from '../../stores/gitStore';
import { storageService } from '../../services/storage/storageService';

export const AppLayout: React.FC = () => {
  const { sendRequest, saveActiveRequest, addTab, closeTab, activeTabId } = useRequestStore();
  const { theme } = useUiStore();
  const { activeView, setSettingsOpen, setCommandPaletteOpen } = useAppStore();

  // Initialize IndexedDB storage, desktop Tauri capabilities, and hydrate stores on boot
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
        useDesktopStore.getState().initializeDesktopRuntime(),
        useWorkspaceStore.getState().loadWorkspaces(),
        useSpecStore.getState().loadSpecs(),
        useMockStore.getState().loadMockServers(),
        useContractStore.getState().loadReports(),
        useGitStore.getState().loadGitConfig(),
      ]);
    };
    bootstrapStorage();
  }, []);

  // Global & desktop keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const keyLower = e.key.toLowerCase();

      if (e.key === 'Enter') {
        e.preventDefault();
        sendRequest();
      } else if (e.shiftKey && keyLower === 's') {
        e.preventDefault();
        saveActiveRequest();
      } else if (keyLower === 's') {
        e.preventDefault();
        saveActiveRequest();
      } else if (
        (e.shiftKey && keyLower === 'n') ||
        keyLower === 'n' ||
        (keyLower === 't' &&
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))
      ) {
        e.preventDefault();
        addTab();
      } else if (keyLower === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      } else if (keyLower === 'l') {
        e.preventDefault();
        const urlInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="URL"], input[placeholder*="https://"]'
        );
        urlInput?.focus();
        urlInput?.select();
      } else if (e.shiftKey && keyLower === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    sendRequest,
    saveActiveRequest,
    addTab,
    closeTab,
    activeTabId,
    setSettingsOpen,
    setCommandPaletteOpen,
  ]);

  const renderMainContent = () => {
    if (activeView === 'runner') return <CollectionRunner />;
    if (activeView === 'suites') return <TestSuiteManager />;
    if (activeView === 'reports') return <TestReports />;
    if (activeView === 'templates') return <ScriptTemplates />;
    if (activeView === 'schemas') return <SchemaValidator mode="library" />;
    if (activeView === 'comparison') return <ResponseComparisonWorkspace />;
    if (activeView === 'devtools') return <DeveloperToolsDashboard />;
    if (activeView === 'apis') return <ApiExplorerView />;
    if (activeView === 'spec-editor') return <SpecEditorView />;
    if (activeView === 'api-docs') return <ApiDocsView />;
    if (activeView === 'api-versions') return <ApiVersionsView />;
    if (activeView === 'contract-tests') return <ContractTestingView />;
    if (activeView === 'mock-servers') return <MockServerView />;
    if (activeView === 'git') return <GitWorkspaceView />;
    if (activeView === 'workspaces') return <WorkspaceDashboard />;

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
      <SqliteMigrationModal />
      <GlobalVariablesModal />
      <EnvironmentModal />
      <ExecutionConsole />
    </div>
  );
};
