import { db, ApiStudioDatabase } from '../database/database';
import { HistoryItem } from '../types';

export interface IHistoryRepository {
  getAll(): Promise<HistoryItem[]>;
  getById(id: string): Promise<HistoryItem | undefined>;
  add(item: HistoryItem, retentionLimit?: number, retainResponseBody?: boolean): Promise<string>;
  delete(id: string): Promise<void>;
  deleteBatch(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}

export class HistoryRepository implements IHistoryRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<HistoryItem[]> {
    const list = await this.database.history.toArray();
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getById(id: string): Promise<HistoryItem | undefined> {
    return this.database.history.get(id);
  }

  async add(item: HistoryItem, retentionLimit = 50, retainResponseBody = true): Promise<string> {
    const sanitizedItem: HistoryItem = {
      ...item,
      responseBodySnippet: retainResponseBody ? item.responseBodySnippet : undefined,
    };

    await this.database.transaction('rw', this.database.history, async () => {
      await this.database.history.put(sanitizedItem);

      // Check retention count
      const count = await this.database.history.count();
      if (count > retentionLimit) {
        const excess = count - retentionLimit;
        const oldest = await this.database.history.orderBy('timestamp').limit(excess).primaryKeys();
        await this.database.history.bulkDelete(oldest);
      }
    });

    return item.id;
  }

  async delete(id: string): Promise<void> {
    await this.database.history.delete(id);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    await this.database.history.bulkDelete(ids);
  }

  async clear(): Promise<void> {
    await this.database.history.clear();
  }
}

export const historyRepository = new HistoryRepository();
