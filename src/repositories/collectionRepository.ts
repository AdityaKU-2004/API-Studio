import { db, ApiStudioDatabase } from '../database/database';
import { CollectionDefinition } from '../types';

export interface ICollectionRepository {
  getAll(): Promise<CollectionDefinition[]>;
  getById(id: string): Promise<CollectionDefinition | undefined>;
  create(collection: CollectionDefinition): Promise<string>;
  update(id: string, updates: Partial<CollectionDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
  reorder(idsInOrder: string[]): Promise<void>;
}

export class CollectionRepository implements ICollectionRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<CollectionDefinition[]> {
    const list = await this.database.collections.toArray();
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async getById(id: string): Promise<CollectionDefinition | undefined> {
    return this.database.collections.get(id);
  }

  async create(collection: CollectionDefinition): Promise<string> {
    await this.database.collections.add(collection);
    return collection.id;
  }

  async update(id: string, updates: Partial<CollectionDefinition>): Promise<void> {
    await this.database.collections.update(id, { ...updates, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    // Transactional cascade: delete collection, folders in this collection, and requests in this collection
    await this.database.transaction('rw', [this.database.collections, this.database.folders, this.database.requests], async () => {
      await this.database.requests.where('collectionId').equals(id).delete();
      await this.database.folders.where('collectionId').equals(id).delete();
      await this.database.collections.delete(id);
    });
  }

  async reorder(idsInOrder: string[]): Promise<void> {
    await this.database.transaction('rw', this.database.collections, async () => {
      for (let i = 0; i < idsInOrder.length; i++) {
        await this.database.collections.update(idsInOrder[i], { order: i, updatedAt: Date.now() });
      }
    });
  }
}

export const collectionRepository = new CollectionRepository();
