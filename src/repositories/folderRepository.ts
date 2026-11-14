import { db, ApiStudioDatabase } from '../database/database';
import { FolderDefinition } from '../types';

export interface IFolderRepository {
  getAll(): Promise<FolderDefinition[]>;
  getByCollectionId(collectionId: string): Promise<FolderDefinition[]>;
  getById(id: string): Promise<FolderDefinition | undefined>;
  create(folder: FolderDefinition): Promise<string>;
  update(id: string, updates: Partial<FolderDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
  move(folderId: string, targetCollectionId: string, targetParentId?: string | null): Promise<boolean>;
  getDescendantFolderIds(folderId: string): Promise<string[]>;
  reorder(idsInOrder: string[]): Promise<void>;
}

export class FolderRepository implements IFolderRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<FolderDefinition[]> {
    const list = await this.database.folders.toArray();
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async getByCollectionId(collectionId: string): Promise<FolderDefinition[]> {
    const list = await this.database.folders.where('collectionId').equals(collectionId).toArray();
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async getById(id: string): Promise<FolderDefinition | undefined> {
    return this.database.folders.get(id);
  }

  async create(folder: FolderDefinition): Promise<string> {
    await this.database.folders.add(folder);
    return folder.id;
  }

  async update(id: string, updates: Partial<FolderDefinition>): Promise<void> {
    await this.database.folders.update(id, { ...updates, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    // Find all descendant folder IDs recursively to delete
    const allFolders = await this.database.folders.toArray();
    const folderIdsToDelete = new Set<string>([id]);

    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      for (const f of allFolders) {
        if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
          folderIdsToDelete.add(f.id);
          addedMore = true;
        }
      }
    }

    const idsArray = Array.from(folderIdsToDelete);

    await this.database.transaction('rw', [this.database.folders, this.database.requests], async () => {
      // Delete requests inside these folders
      for (const fId of idsArray) {
        await this.database.requests.where('folderId').equals(fId).delete();
        await this.database.folders.delete(fId);
      }
    });
  }

  /**
   * Moves a folder into a new collection or folder, strictly preventing circular nesting.
   */
  async move(
    folderId: string,
    targetCollectionId: string,
    targetParentId: string | null = null
  ): Promise<boolean> {
    // Prevent moving folder into itself
    if (folderId === targetParentId) {
      return false;
    }

    // Check if targetParentId is a descendant of folderId (circular dependency)
    if (targetParentId) {
      const allFolders = await this.database.folders.toArray();
      let currentParent: string | null | undefined = targetParentId;

      while (currentParent) {
        if (currentParent === folderId) {
          // Circular nesting detected!
          return false;
        }
        const parentFolder = allFolders.find((f) => f.id === currentParent);
        currentParent = parentFolder ? parentFolder.parentId : null;
      }
    }

    // Move is safe: update folder and recursively update its descendants' collectionId
    await this.database.transaction('rw', [this.database.folders, this.database.requests], async () => {
      await this.database.folders.update(folderId, {
        collectionId: targetCollectionId,
        parentId: targetParentId,
        updatedAt: Date.now(),
      });

      // Update requests in this folder to the new collectionId
      await this.database.requests
        .where('folderId')
        .equals(folderId)
        .modify({ collectionId: targetCollectionId, updatedAt: Date.now() });

      // Find all descendant folders and update their collectionId
      const allFolders = await this.database.folders.toArray();
      const descendantFolderIds = new Set<string>();

      let changed = true;
      while (changed) {
        changed = false;
        for (const f of allFolders) {
          if (
            f.parentId &&
            (f.parentId === folderId || descendantFolderIds.has(f.parentId)) &&
            !descendantFolderIds.has(f.id)
          ) {
            descendantFolderIds.add(f.id);
            changed = true;
          }
        }
      }

      for (const dId of descendantFolderIds) {
        await this.database.folders.update(dId, { collectionId: targetCollectionId, updatedAt: Date.now() });
        await this.database.requests
          .where('folderId')
          .equals(dId)
          .modify({ collectionId: targetCollectionId, updatedAt: Date.now() });
      }
    });

    return true;
  }

  async getDescendantFolderIds(folderId: string): Promise<string[]> {
    const allFolders = await this.database.folders.toArray();
    const descendantFolderIds = new Set<string>();

    let changed = true;
    while (changed) {
      changed = false;
      for (const f of allFolders) {
        if (
          f.parentId &&
          (f.parentId === folderId || descendantFolderIds.has(f.parentId)) &&
          !descendantFolderIds.has(f.id)
        ) {
          descendantFolderIds.add(f.id);
          changed = true;
        }
      }
    }
    return Array.from(descendantFolderIds);
  }

  async reorder(idsInOrder: string[]): Promise<void> {
    await this.database.transaction('rw', this.database.folders, async () => {
      for (let i = 0; i < idsInOrder.length; i++) {
        await this.database.folders.update(idsInOrder[i], { order: i, updatedAt: Date.now() });
      }
    });
  }
}

export const folderRepository = new FolderRepository();
