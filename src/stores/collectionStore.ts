import { create } from 'zustand';
import {
  CollectionItem,
  CollectionDefinition,
  FolderDefinition,
  ApiRequest,
  AuthConfig,
  KeyValueItem,
  EnvironmentVariable,
} from '../types';
import { initialCollections, sampleRequests } from '../data/mockData';
import { collectionRepository } from '../repositories/collectionRepository';
import { folderRepository } from '../../src/repositories/folderRepository';
import { requestRepository } from '../../src/repositories/requestRepository';
import { storageService } from '../services/storage/storageService';

interface DragItemInfo {
  type: 'request' | 'folder' | 'collection';
  id: string;
  sourceCollectionId?: string;
  sourceFolderId?: string | null;
}

interface CollectionState {
  collections: CollectionItem[];
  expandedIds: Record<string, boolean>;
  isLoading: boolean;
  activeCollectionSettingsId: string | null;
  isRunnerModalOpen: boolean;
  runnerTargetCollectionId: string | null;
  draggedItem: DragItemInfo | null;

  // Initializer
  loadCollections: () => Promise<void>;

  // Expansion
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;

  // Collection CRUD
  addCollection: (
    name: string,
    description?: string,
    color?: string,
    icon?: string,
    auth?: AuthConfig,
    headers?: KeyValueItem[],
    variables?: EnvironmentVariable[]
  ) => Promise<string>;
  renameCollection: (id: string, name: string) => Promise<void>;
  updateCollection: (id: string, updates: Partial<CollectionDefinition>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  duplicateCollection: (id: string) => Promise<string | null>;
  reorderCollections: (idsInOrder: string[]) => Promise<void>;

  // Folder CRUD & Movement
  addFolder: (collectionId: string, folderName: string, parentId?: string | null) => Promise<string>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  updateFolder: (folderId: string, updates: Partial<FolderDefinition>) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveFolder: (folderId: string, targetCollectionId: string, targetParentId?: string | null) => Promise<boolean>;

  // Request CRUD & Movement
  addRequestToCollection: (
    collectionId: string,
    folderId: string | null,
    request: ApiRequest
  ) => Promise<string>;
  duplicateRequest: (requestId: string) => Promise<string | null>;
  deleteRequest: (requestId: string) => Promise<void>;
  moveRequest: (requestId: string, targetCollectionId: string, targetFolderId?: string | null) => Promise<void>;
  findRequestById: (requestId: string) => ApiRequest | undefined;

  // UI Modals & DND
  setActiveCollectionSettingsId: (id: string | null) => void;
  setRunnerModalOpen: (open: boolean, collectionId?: string | null) => void;
  setDraggedItem: (item: DragItemInfo | null) => void;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: initialCollections,
  expandedIds: {
    'col-users': true,
    'col-products': true,
    'col-auth': true,
  },
  isLoading: false,
  activeCollectionSettingsId: null,
  isRunnerModalOpen: false,
  runnerTargetCollectionId: null,
  draggedItem: null,

  loadCollections: async () => {
    set({ isLoading: true });
    try {
      const tree = await storageService.buildCollectionTree();
      if (tree.length > 0) {
        set({ collections: tree, isLoading: false });
      } else {
        set({ collections: initialCollections, isLoading: false });
      }
    } catch {
      set({ collections: initialCollections, isLoading: false });
    }
  },

  toggleExpanded: (id) =>
    set((state) => ({
      expandedIds: {
        ...state.expandedIds,
        [id]: !state.expandedIds[id],
      },
    })),

  setExpanded: (id, expanded) =>
    set((state) => ({
      expandedIds: {
        ...state.expandedIds,
        [id]: expanded,
      },
    })),

  addCollection: async (name, description, color = 'cyan', icon = 'folder', auth, headers, variables) => {
    const newId = 'col-' + Date.now();
    const now = Date.now();
    const newColDef: CollectionDefinition = {
      id: newId,
      name: name.trim() || 'New Collection',
      description: description || 'Collection of API endpoints',
      color,
      icon,
      auth: auth || { type: 'none' },
      headers: headers || [],
      variables: variables || [],
      order: get().collections.length + 1,
      createdAt: now,
      updatedAt: now,
    };

    await collectionRepository.create(newColDef);
    await get().loadCollections();

    set((state) => ({
      expandedIds: { ...state.expandedIds, [newId]: true },
    }));

    return newId;
  },

  renameCollection: async (id, name) => {
    await collectionRepository.update(id, { name: name.trim() });
    await get().loadCollections();
  },

  updateCollection: async (id, updates) => {
    await collectionRepository.update(id, updates);
    await get().loadCollections();
  },

  deleteCollection: async (id) => {
    await collectionRepository.delete(id);
    await get().loadCollections();
  },

  duplicateCollection: async (id) => {
    const existing = await collectionRepository.getById(id);
    if (!existing) return null;

    const newColId = 'col-' + Date.now();
    const now = Date.now();
    const duplicatedCol: CollectionDefinition = {
      ...JSON.parse(JSON.stringify(existing)),
      id: newColId,
      name: `${existing.name} (Copy)`,
      order: get().collections.length + 1,
      createdAt: now,
      updatedAt: now,
    };

    await collectionRepository.create(duplicatedCol);

    // Duplicate folders in this collection
    const originalFolders = await folderRepository.getByCollectionId(id);
    const folderIdMap = new Map<string, string>();

    for (const f of originalFolders) {
      const newFolderId = 'fld-' + now + Math.random().toString(36).substring(2, 6);
      folderIdMap.set(f.id, newFolderId);
    }

    for (const f of originalFolders) {
      const newFolderId = folderIdMap.get(f.id)!;
      const newParentId = f.parentId && folderIdMap.has(f.parentId) ? folderIdMap.get(f.parentId) : null;
      await folderRepository.create({
        ...JSON.parse(JSON.stringify(f)),
        id: newFolderId,
        collectionId: newColId,
        parentId: newParentId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Duplicate requests
    const originalRequests = await requestRepository.getByCollectionId(id);
    for (const r of originalRequests) {
      const newReqId = 'req-' + now + Math.random().toString(36).substring(2, 6);
      const newFolderId = r.folderId && folderIdMap.has(r.folderId) ? folderIdMap.get(r.folderId) : undefined;
      await requestRepository.create({
        ...JSON.parse(JSON.stringify(r)),
        id: newReqId,
        collectionId: newColId,
        folderId: newFolderId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await get().loadCollections();
    set((state) => ({
      expandedIds: { ...state.expandedIds, [newColId]: true },
    }));

    return newColId;
  },

  reorderCollections: async (idsInOrder) => {
    await collectionRepository.reorder(idsInOrder);
    await get().loadCollections();
  },

  addFolder: async (collectionId, folderName, parentId = null) => {
    const folderId = 'fld-' + Date.now();
    const now = Date.now();
    const newFolderDef: FolderDefinition = {
      id: folderId,
      collectionId,
      parentId,
      name: folderName.trim() || 'New Folder',
      auth: { type: 'inherit' },
      headers: [],
      variables: [],
      order: 99,
      createdAt: now,
      updatedAt: now,
    };

    await folderRepository.create(newFolderDef);
    await get().loadCollections();

    set((state) => ({
      expandedIds: { ...state.expandedIds, [collectionId]: true, [folderId]: true },
    }));

    return folderId;
  },

  renameFolder: async (folderId, name) => {
    await folderRepository.update(folderId, { name: name.trim() });
    await get().loadCollections();
  },

  updateFolder: async (folderId, updates) => {
    await folderRepository.update(folderId, updates);
    await get().loadCollections();
  },

  deleteFolder: async (folderId) => {
    await folderRepository.delete(folderId);
    await get().loadCollections();
  },

  moveFolder: async (folderId, targetCollectionId, targetParentId = null) => {
    const success = await folderRepository.move(folderId, targetCollectionId, targetParentId);
    if (success) {
      await get().loadCollections();
    }
    return success;
  },

  addRequestToCollection: async (collectionId, folderId, request) => {
    const reqWithLocation: ApiRequest = {
      ...request,
      collectionId,
      folderId: folderId || undefined,
      updatedAt: Date.now(),
    };

    await requestRepository.create(reqWithLocation);
    await get().loadCollections();

    set((state) => ({
      expandedIds: {
        ...state.expandedIds,
        [collectionId]: true,
        ...(folderId ? { [folderId]: true } : {}),
      },
    }));

    return request.id;
  },

  duplicateRequest: async (requestId) => {
    const duplicated = await requestRepository.duplicate(requestId);
    if (!duplicated) return null;

    await get().loadCollections();
    return duplicated.id;
  },

  deleteRequest: async (requestId) => {
    await requestRepository.delete(requestId);
    await get().loadCollections();
  },

  moveRequest: async (requestId, targetCollectionId, targetFolderId = null) => {
    await requestRepository.move(requestId, targetCollectionId, targetFolderId);
    await get().loadCollections();
  },

  findRequestById: (requestId) => {
    if (sampleRequests[requestId]) {
      return sampleRequests[requestId];
    }

    const search = (items: CollectionItem[]): ApiRequest | undefined => {
      for (const item of items) {
        if (item.type === 'request') {
          if (item.requestId === requestId && item.request) {
            return item.request;
          }
          if (item.request?.id === requestId) {
            return item.request;
          }
        }
        if (item.children) {
          const found = search(item.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    return search(get().collections);
  },

  setActiveCollectionSettingsId: (id) => set({ activeCollectionSettingsId: id }),
  setRunnerModalOpen: (open, collectionId = null) =>
    set({ isRunnerModalOpen: open, runnerTargetCollectionId: collectionId }),
  setDraggedItem: (item) => set({ draggedItem: item }),
}));
