import { create } from 'zustand';
import { Workspace, SidebarSection } from '../types';
import { initialWorkspaces } from '../data/mockData';

interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeView: SidebarSection;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  isDocsOpen: boolean;
  isNewCollectionModalOpen: boolean;
  isNewFolderModalOpen: boolean;
  isNewRequestModalOpen: boolean;
  isCodeSnippetModalOpen: boolean;
  isEnvironmentModalOpen: boolean;
  isGlobalVariablesModalOpen: boolean;
  isImportExportModalOpen: boolean;
  isBackupRestoreModalOpen: boolean;
  importExportMode: 'import' | 'export';
  targetCollectionIdForNewItem: string | null;
  targetFolderIdForNewItem: string | null;
  targetCollectionIdForExport: string | null;

  setActiveWorkspaceId: (id: string) => void;
  setActiveView: (view: SidebarSection) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setDocsOpen: (open: boolean) => void;
  setNewCollectionModalOpen: (open: boolean) => void;
  setNewFolderModalOpen: (open: boolean, collectionId?: string) => void;
  setNewRequestModalOpen: (open: boolean, collectionId?: string, folderId?: string) => void;
  setCodeSnippetModalOpen: (open: boolean) => void;
  setEnvironmentModalOpen: (open: boolean) => void;
  setGlobalVariablesModalOpen: (open: boolean) => void;
  setImportExportModalOpen: (open: boolean, mode?: 'import' | 'export', collectionId?: string | null) => void;
  setBackupRestoreModalOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  workspaces: initialWorkspaces,
  activeWorkspaceId: 'ws-default',
  activeView: 'collections',
  isCommandPaletteOpen: false,
  isSettingsOpen: false,
  isDocsOpen: false,
  isNewCollectionModalOpen: false,
  isNewFolderModalOpen: false,
  isNewRequestModalOpen: false,
  isCodeSnippetModalOpen: false,
  isEnvironmentModalOpen: false,
  isGlobalVariablesModalOpen: false,
  isImportExportModalOpen: false,
  isBackupRestoreModalOpen: false,
  importExportMode: 'export',
  targetCollectionIdForNewItem: null,
  targetFolderIdForNewItem: null,
  targetCollectionIdForExport: null,

  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setActiveView: (view) => set({ activeView: view }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setDocsOpen: (open) => set({ isDocsOpen: open }),
  setNewCollectionModalOpen: (open) => set({ isNewCollectionModalOpen: open }),
  setNewFolderModalOpen: (open, collectionId) =>
    set({
      isNewFolderModalOpen: open,
      targetCollectionIdForNewItem: collectionId || null,
    }),
  setNewRequestModalOpen: (open, collectionId, folderId) =>
    set({
      isNewRequestModalOpen: open,
      targetCollectionIdForNewItem: collectionId || null,
      targetFolderIdForNewItem: folderId || null,
    }),
  setCodeSnippetModalOpen: (open) => set({ isCodeSnippetModalOpen: open }),
  setEnvironmentModalOpen: (open) => set({ isEnvironmentModalOpen: open }),
  setGlobalVariablesModalOpen: (open) => set({ isGlobalVariablesModalOpen: open }),
  setImportExportModalOpen: (open, mode = 'export', collectionId = null) =>
    set({
      isImportExportModalOpen: open,
      importExportMode: mode,
      targetCollectionIdForExport: collectionId,
    }),
  setBackupRestoreModalOpen: (open) => set({ isBackupRestoreModalOpen: open }),
}));
