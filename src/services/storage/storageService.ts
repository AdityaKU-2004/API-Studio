import { db, ApiStudioDatabase } from '../../database/database';
import { runMigrationsAndSeed } from '../../database/migrations';
import { CollectionRepository, collectionRepository } from '../../repositories/collectionRepository';
import { FolderRepository, folderRepository } from '../../repositories/folderRepository';
import { RequestRepository, requestRepository } from '../../repositories/requestRepository';
import {
  CollectionItem,
  CollectionDefinition,
  FolderDefinition,
  ApiRequest,
  AuthConfig,
  KeyValueItem,
} from '../../types';

export class StorageService {
  private initialized = false;
  private colRepo: CollectionRepository;
  private fldRepo: FolderRepository;
  private reqRepo: RequestRepository;

  constructor(private database: ApiStudioDatabase = db) {
    this.colRepo = new CollectionRepository(database);
    this.fldRepo = new FolderRepository(database);
    this.reqRepo = new RequestRepository(database);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await runMigrationsAndSeed(this.database);
      this.initialized = true;
    } catch (err) {
      console.warn('StorageService init warning:', err);
    }
  }

  /**
   * Constructs the full nested CollectionItem[] tree from flat IndexedDB records.
   */
  async buildCollectionTree(): Promise<CollectionItem[]> {
    await this.init();

    const [collections, folders, requests] = await Promise.all([
      this.colRepo.getAll(),
      this.fldRepo.getAll(),
      this.reqRepo.getAll(),
    ]);

    // Build map of folders by collectionId
    const foldersByCollection = new Map<string, FolderDefinition[]>();
    for (const f of folders) {
      const list = foldersByCollection.get(f.collectionId) || [];
      list.push(f);
      foldersByCollection.set(f.collectionId, list);
    }

    // Build map of requests by collectionId and folderId
    const requestsByParent = new Map<string, ApiRequest[]>();
    for (const r of requests) {
      const parentKey = r.folderId ? `fld:${r.folderId}` : `col:${r.collectionId}`;
      const list = requestsByParent.get(parentKey) || [];
      list.push(r);
      requestsByParent.set(parentKey, list);
    }

    // Helper to build recursive folder nodes
    const buildFolderNodes = (
      collectionId: string,
      parentId: string | null = null
    ): CollectionItem[] => {
      const colFolders = foldersByCollection.get(collectionId) || [];
      const matchingFolders = colFolders.filter((f) => (f.parentId || null) === parentId);

      return matchingFolders.map((f) => {
        const subFolders = buildFolderNodes(collectionId, f.id);
        const folderRequests = (requestsByParent.get(`fld:${f.id}`) || []).map((r) => ({
          id: `item-${r.id}`,
          name: r.name,
          type: 'request' as const,
          collectionId,
          parentId: f.id,
          requestId: r.id,
          request: r,
          order: r.order,
        }));

        const children: CollectionItem[] = [...subFolders, ...folderRequests];

        return {
          id: f.id,
          name: f.name,
          type: 'folder' as const,
          collectionId,
          parentId: f.parentId,
          auth: f.auth,
          headers: f.headers,
          variables: f.variables,
          description: f.description,
          order: f.order,
          children,
        };
      });
    };

    // Build root collection nodes
    const tree: CollectionItem[] = collections.map((col) => {
      const folderNodes = buildFolderNodes(col.id, null);
      const rootRequests = (requestsByParent.get(`col:${col.id}`) || []).map((r) => ({
        id: `item-${r.id}`,
        name: r.name,
        type: 'request' as const,
        collectionId: col.id,
        parentId: col.id,
        requestId: r.id,
        request: r,
        order: r.order,
      }));

      const children = [...folderNodes, ...rootRequests];

      return {
        id: col.id,
        name: col.name,
        type: 'collection' as const,
        collectionId: col.id,
        description: col.description,
        color: col.color,
        icon: col.icon,
        auth: col.auth,
        headers: col.headers,
        variables: col.variables,
        order: col.order,
        children,
      };
    });

    return tree;
  }

  /**
   * Resolves effective authentication and inherited headers for a request given its hierarchy.
   */
  async resolveEffectiveConfiguration(request: ApiRequest): Promise<{
    effectiveAuth: AuthConfig;
    inheritedHeaders: KeyValueItem[];
    effectiveHeaders: KeyValueItem[];
    inheritedFrom: { authSource?: string; headersSource?: string };
  }> {
    await this.init();

    let parentFolder: FolderDefinition | undefined;
    let parentCollection: CollectionDefinition | undefined;

    if (request.folderId) {
      parentFolder = await this.fldRepo.getById(request.folderId);
    }
    if (request.collectionId) {
      parentCollection = await this.colRepo.getById(request.collectionId);
    }

    // 1. Resolve Auth Inheritance
    let effectiveAuth = request.auth || { type: 'none' };
    let authSource: string | undefined;

    if (effectiveAuth.type === 'inherit') {
      if (parentFolder?.auth && parentFolder.auth.type !== 'inherit' && parentFolder.auth.type !== 'none') {
        effectiveAuth = parentFolder.auth;
        authSource = `Folder: ${parentFolder.name}`;
      } else if (parentCollection?.auth && parentCollection.auth.type !== 'none') {
        effectiveAuth = parentCollection.auth;
        authSource = `Collection: ${parentCollection.name}`;
      } else {
        effectiveAuth = { type: 'none' };
        authSource = 'No inherited credentials configured';
      }
    }

    // 2. Resolve Inherited Headers
    const inheritedHeadersMap = new Map<string, KeyValueItem>();

    // Collection headers first
    if (parentCollection?.headers) {
      for (const h of parentCollection.headers) {
        if (h.enabled && h.key.trim()) {
          inheritedHeadersMap.set(h.key.toLowerCase(), { ...h, description: `Inherited from collection: ${parentCollection.name}` });
        }
      }
    }

    // Folder headers override collection headers
    if (parentFolder?.headers) {
      for (const h of parentFolder.headers) {
        if (h.enabled && h.key.trim()) {
          inheritedHeadersMap.set(h.key.toLowerCase(), { ...h, description: `Inherited from folder: ${parentFolder.name}` });
        }
      }
    }

    const inheritedHeaders = Array.from(inheritedHeadersMap.values());

    // Request headers override inherited headers by key
    const effectiveHeadersMap = new Map<string, KeyValueItem>(inheritedHeadersMap);
    for (const h of request.headers || []) {
      if (h.enabled && h.key.trim()) {
        effectiveHeadersMap.set(h.key.toLowerCase(), h);
      }
    }

    return {
      effectiveAuth,
      inheritedHeaders,
      effectiveHeaders: Array.from(effectiveHeadersMap.values()),
      inheritedFrom: {
        authSource,
        headersSource: parentFolder ? `Folder: ${parentFolder.name}` : parentCollection ? `Collection: ${parentCollection.name}` : undefined,
      },
    };
  }
}

export const storageService = new StorageService();
