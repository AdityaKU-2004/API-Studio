import { db, ApiStudioDatabase } from '../database/database';
import { TestSuite } from '../types';

export class TestSuiteRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<TestSuite[]> {
    return this.database.testSuites.orderBy('updatedAt').reverse().toArray();
  }

  async getById(id: string): Promise<TestSuite | undefined> {
    return this.database.testSuites.get(id);
  }

  async save(suite: TestSuite): Promise<string> {
    return this.database.testSuites.put({
      ...suite,
      updatedAt: Date.now(),
    });
  }

  async create(suite: TestSuite): Promise<string> {
    const now = Date.now();
    return this.database.testSuites.add({
      ...suite,
      createdAt: suite.createdAt || now,
      updatedAt: suite.updatedAt || now,
    });
  }

  async update(id: string, updates: Partial<TestSuite>): Promise<number> {
    return this.database.testSuites.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.testSuites.delete(id);
  }
}

export const testSuiteRepository = new TestSuiteRepository();
