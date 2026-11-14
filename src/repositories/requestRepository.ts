import { db, ApiStudioDatabase } from '../database/database';
import { ApiRequest } from '../types';

export interface IRequestRepository {
  getAll(): Promise<ApiRequest[]>;
  getById(id: string): Promise<ApiRequest | undefined>;
  getByCollectionId(collectionId: string): Promise<ApiRequest[]>;
  getByFolderId(folderId: string): Promise<ApiRequest[]>;
  create(request: ApiRequest): Promise<string>;
  update(id: string, updates: Partial<ApiRequest>): Promise<void>;
  delete(id: string): Promise<void>;
  duplicate(id: string, newName?: string): Promise<ApiRequest | null>;
  move(requestId: string, targetCollectionId: string, targetFolderId?: string | null): Promise<void>;
  reorder(idsInOrder: string[]): Promise<void>;
}

export class RequestRepository implements IRequestRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<ApiRequest[]> {
    const list = await this.database.requests.toArray();
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async getById(id: string): Promise<ApiRequest | undefined> {
    return this.database.requests.get(id);
  }

  async getByCollectionId(collectionId: string): Promise<ApiRequest[]> {
    const list = await this.database.requests.where('collectionId').equals(collectionId).toArray();
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async getByFolderId(folderId: string): Promise<ApiRequest[]> {
    const list = await this.database.requests.where('folderId').equals(folderId).toArray();
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async create(request: ApiRequest): Promise<string> {
    await this.database.requests.put(request);
    return request.id;
  }

  async update(id: string, updates: Partial<ApiRequest>): Promise<void> {
    await this.database.requests.update(id, { ...updates, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.database.requests.delete(id);
  }

  async duplicate(id: string, newName?: string): Promise<ApiRequest | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const duplicated: ApiRequest = {
      ...JSON.parse(JSON.stringify(existing)),
      id: 'req-' + Date.now() + Math.random().toString(36).substring(2, 6),
      name: newName || `${existing.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.database.requests.add(duplicated);
    return duplicated;
  }

  async move(requestId: string, targetCollectionId: string, targetFolderId: string | null = null): Promise<void> {
    await this.database.requests.update(requestId, {
      collectionId: targetCollectionId,
      folderId: targetFolderId || undefined,
      updatedAt: Date.now(),
    });
  }

  async reorder(idsInOrder: string[]): Promise<void> {
    await this.database.transaction('rw', this.database.requests, async () => {
      for (let i = 0; i < idsInOrder.length; i++) {
        await this.database.requests.update(idsInOrder[i], { order: i, updatedAt: Date.now() });
      }
    });
  }
}

export const requestRepository = new RequestRepository();
