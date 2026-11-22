import { db, ApiStudioDatabase } from '../database/database';
import { ComparisonSession } from '../types';

export class ComparisonRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<ComparisonSession[]> {
    const list = await this.database.comparisonSessions.toArray();
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getById(id: string): Promise<ComparisonSession | undefined> {
    return this.database.comparisonSessions.get(id);
  }

  async save(session: ComparisonSession): Promise<string> {
    await this.database.comparisonSessions.put(session);
    return session.id;
  }

  async delete(id: string): Promise<void> {
    await this.database.comparisonSessions.delete(id);
  }
}

export const comparisonRepository = new ComparisonRepository();
