import { CollectionItem, ApiRequest } from '../../types';
import { initialCollections } from '../../data/mockData';

export interface ICollectionService {
  getCollections(): Promise<CollectionItem[]>;
  saveCollection(collection: CollectionItem): Promise<void>;
  deleteCollection(id: string): Promise<void>;
}

export class MockCollectionService implements ICollectionService {
  private collections: CollectionItem[] = [...initialCollections];

  async getCollections(): Promise<CollectionItem[]> {
    return JSON.parse(JSON.stringify(this.collections));
  }

  async saveCollection(collection: CollectionItem): Promise<void> {
    const idx = this.collections.findIndex((c) => c.id === collection.id);
    if (idx >= 0) {
      this.collections[idx] = collection;
    } else {
      this.collections.push(collection);
    }
  }

  async deleteCollection(id: string): Promise<void> {
    this.collections = this.collections.filter((c) => c.id !== id);
  }
}

export const collectionService = new MockCollectionService();
