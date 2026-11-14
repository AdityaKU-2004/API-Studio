import { db, ApiStudioDatabase } from '../database/database';
import { Environment } from '../types';

export interface IEnvironmentRepository {
  getAll(): Promise<Environment[]>;
  getById(id: string): Promise<Environment | undefined>;
  create(env: Environment): Promise<string>;
  update(id: string, updates: Partial<Environment>): Promise<void>;
  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<Environment | null>;
}

export class EnvironmentRepository implements IEnvironmentRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<Environment[]> {
    const list = await this.database.environments.toArray();
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async getById(id: string): Promise<Environment | undefined> {
    return this.database.environments.get(id);
  }

  async create(env: Environment): Promise<string> {
    await this.database.environments.put(env);
    return env.id;
  }

  async update(id: string, updates: Partial<Environment>): Promise<void> {
    await this.database.environments.update(id, { ...updates, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.database.environments.delete(id);
  }

  async duplicate(id: string): Promise<Environment | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const duplicated: Environment = {
      ...JSON.parse(JSON.stringify(existing)),
      id: 'env-' + Date.now(),
      name: `${existing.name} (Copy)`,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.database.environments.add(duplicated);
    return duplicated;
  }
}

export const environmentRepository = new EnvironmentRepository();
