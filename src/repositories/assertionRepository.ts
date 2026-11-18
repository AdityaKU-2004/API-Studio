import { db, ApiStudioDatabase } from '../database/database';
import { AssertionConfiguration } from '../types';

export class AssertionRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<AssertionConfiguration[]> {
    return this.database.assertionConfigurations.orderBy('updatedAt').reverse().toArray();
  }

  async getById(id: string): Promise<AssertionConfiguration | undefined> {
    return this.database.assertionConfigurations.get(id);
  }

  async save(config: AssertionConfiguration): Promise<string> {
    return this.database.assertionConfigurations.put({
      ...config,
      updatedAt: Date.now(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.assertionConfigurations.delete(id);
  }
}

export const assertionRepository = new AssertionRepository();
