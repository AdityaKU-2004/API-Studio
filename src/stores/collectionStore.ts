import { create } from 'zustand';
import { CollectionItem, ApiRequest } from '../types';
import { initialCollections, sampleRequests } from '../data/mockData';

interface CollectionState {
  collections: CollectionItem[];
  expandedIds: Record<string, boolean>;

  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  addCollection: (name: string, description?: string) => string;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addFolder: (collectionId: string, folderName: string) => string;
  renameFolder: (folderId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  addRequestToCollection: (collectionId: string, folderId: string | null, request: ApiRequest) => string;
  duplicateRequest: (requestId: string) => string | null;
  deleteRequest: (requestId: string) => void;
  findRequestById: (requestId: string) => ApiRequest | undefined;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: initialCollections,
  expandedIds: {
    'col-users': true,
    'col-products': true,
    'col-auth': true,
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

  addCollection: (name, description) => {
    const newId = 'col-' + Date.now();
    const newCol: CollectionItem = {
      id: newId,
      name: name.trim() || 'New Collection',
      type: 'collection',
      description: description || 'Collection of API endpoints',
      children: [],
      isExpanded: true,
    };
    set((state) => ({
      collections: [...state.collections, newCol],
      expandedIds: { ...state.expandedIds, [newId]: true },
    }));
    return newId;
  },

  renameCollection: (id, name) =>
    set((state) => ({
      collections: state.collections.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c)),
    })),

  deleteCollection: (id) =>
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
    })),

  addFolder: (collectionId, folderName) => {
    const folderId = 'fld-' + Date.now();
    const newFolder: CollectionItem = {
      id: folderId,
      name: folderName.trim() || 'New Folder',
      type: 'folder',
      parentId: collectionId,
      children: [],
      isExpanded: true,
    };

    set((state) => ({
      collections: state.collections.map((c) => {
        if (c.id === collectionId) {
          return {
            ...c,
            children: [...(c.children || []), newFolder],
          };
        }
        return c;
      }),
      expandedIds: { ...state.expandedIds, [collectionId]: true, [folderId]: true },
    }));

    return folderId;
  },

  renameFolder: (folderId, name) =>
    set((state) => {
      const updateChildren = (items: CollectionItem[]): CollectionItem[] => {
        return items.map((item) => {
          if (item.id === folderId) {
            return { ...item, name: name.trim() || item.name };
          }
          if (item.children) {
            return { ...item, children: updateChildren(item.children) };
          }
          return item;
        });
      };
      return { collections: updateChildren(state.collections) };
    }),

  deleteFolder: (folderId) =>
    set((state) => {
      const filterChildren = (items: CollectionItem[]): CollectionItem[] => {
        return items
          .filter((item) => item.id !== folderId)
          .map((item) => ({
            ...item,
            children: item.children ? filterChildren(item.children) : [],
          }));
      };
      return { collections: filterChildren(state.collections) };
    }),

  addRequestToCollection: (collectionId, folderId, request) => {
    const reqItem: CollectionItem = {
      id: 'item-' + Date.now(),
      name: request.name,
      type: 'request',
      requestId: request.id,
      request: { ...request, collectionId, folderId: folderId || undefined },
      parentId: folderId || collectionId,
    };

    set((state) => {
      const updateItems = (items: CollectionItem[]): CollectionItem[] => {
        return items.map((col) => {
          if (folderId && col.id === folderId) {
            return { ...col, children: [...(col.children || []), reqItem] };
          }
          if (!folderId && col.id === collectionId) {
            return { ...col, children: [...(col.children || []), reqItem] };
          }
          if (col.children) {
            return { ...col, children: updateItems(col.children) };
          }
          return col;
        });
      };

      return {
        collections: updateItems(state.collections),
        expandedIds: {
          ...state.expandedIds,
          [collectionId]: true,
          ...(folderId ? { [folderId]: true } : {}),
        },
      };
    });

    return reqItem.id;
  },

  duplicateRequest: (requestId) => {
    const { findRequestById, addRequestToCollection } = get();
    const existing = findRequestById(requestId);
    if (!existing) return null;

    const newReqId = 'req-' + Date.now();
    const duplicated: ApiRequest = {
      ...JSON.parse(JSON.stringify(existing)),
      id: newReqId,
      name: `${existing.name} (Copy)`,
    };

    const targetCol = existing.collectionId || 'col-users';
    addRequestToCollection(targetCol, existing.folderId || null, duplicated);
    return newReqId;
  },

  deleteRequest: (requestId) =>
    set((state) => {
      const filterReq = (items: CollectionItem[]): CollectionItem[] => {
        return items
          .filter((item) => !(item.type === 'request' && (item.requestId === requestId || item.request?.id === requestId)))
          .map((item) => ({
            ...item,
            children: item.children ? filterReq(item.children) : [],
          }));
      };
      return { collections: filterReq(state.collections) };
    }),

  findRequestById: (requestId) => {
    // Check in sampleRequests cache first
    if (sampleRequests[requestId]) {
      return sampleRequests[requestId];
    }

    // Traverse collections
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
}));
