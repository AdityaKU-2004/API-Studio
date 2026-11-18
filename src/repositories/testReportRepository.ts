import { db, ApiStudioDatabase } from '../database/database';
import { TestReport } from '../types';

export class TestReportRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(limit = 100): Promise<TestReport[]> {
    const list = await this.database.testReports.orderBy('createdAt').reverse().toArray();
    return limit > 0 ? list.slice(0, limit) : list;
  }

  async getById(id: string): Promise<TestReport | undefined> {
    return this.database.testReports.get(id);
  }

  async save(report: TestReport, retentionLimit = 50): Promise<string> {
    const id = await this.database.testReports.put(report);
    if (retentionLimit > 0) {
      await this.enforceRetention(retentionLimit);
    }
    return id;
  }

  async delete(id: string): Promise<void> {
    await this.database.testReports.delete(id);
  }

  async clearAll(): Promise<void> {
    await this.database.testReports.clear();
  }

  async enforceRetention(maxCount: number): Promise<void> {
    if (maxCount <= 0) return;
    const all = await this.database.testReports.orderBy('createdAt').reverse().toArray();
    if (all.length > maxCount) {
      const idsToDelete = all.slice(maxCount).map((r) => r.id);
      await this.database.testReports.bulkDelete(idsToDelete);
    }
  }
}

export const testReportRepository = new TestReportRepository();
