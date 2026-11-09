import { create } from 'zustand';
import { AuthConfig } from '../types';
import { useCollectionStore } from './collectionStore';

interface AuthState {
  // Resolve effective authentication for a request given collectionId and folderId
  resolveEffectiveAuth: (requestAuth: AuthConfig, collectionId?: string, folderId?: string) => {
    effectiveAuth: AuthConfig;
    source: 'request' | 'collection' | 'folder' | 'none';
    sourceName?: string;
  };
}

export const useAuthStore = create<AuthState>(() => ({
  resolveEffectiveAuth: (requestAuth, collectionId, folderId) => {
    if (requestAuth && requestAuth.type !== 'inherit') {
      return {
        effectiveAuth: requestAuth,
        source: 'request',
        sourceName: 'Request Override',
      };
    }

    const { collections } = useCollectionStore.getState();

    if (collectionId) {
      const col = collections.find((c) => c.id === collectionId);
      if (col) {
        if (folderId && col.children) {
          const folder = col.children.find((f) => f.id === folderId);
          if (folder?.auth && folder.auth.type !== 'inherit' && folder.auth.type !== 'none') {
            return {
              effectiveAuth: folder.auth,
              source: 'folder',
              sourceName: `Folder (${folder.name})`,
            };
          }
        }

        if (col.auth && col.auth.type !== 'inherit' && col.auth.type !== 'none') {
          return {
            effectiveAuth: col.auth,
            source: 'collection',
            sourceName: `Collection (${col.name})`,
          };
        }
      }
    }

    return {
      effectiveAuth: { type: 'none' },
      source: 'none',
      sourceName: 'No Parent Auth (None)',
    };
  },
}));
