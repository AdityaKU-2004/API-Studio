import { db, ApiStudioDatabase } from '../database/database';
import { EnvironmentVariable } from '../types';

export interface IVariableRepository {
  getAllGlobal(): Promise<EnvironmentVariable[]>;
  createGlobal(variable: EnvironmentVariable): Promise<string>;
  updateGlobal(id: string, updates: Partial<EnvironmentVariable>): Promise<void>;
  deleteGlobal(id: string): Promise<void>;
  setAllGlobal(variables: EnvironmentVariable[]): Promise<void>;
}

export class VariableRepository implements IVariableRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAllGlobal(): Promise<EnvironmentVariable[]> {
    return this.database.globalVariables.toArray();
  }

  async createGlobal(variable: EnvironmentVariable): Promise<string> {
    const item: EnvironmentVariable = {
      ...variable,
      scope: 'global',
    };
    await this.database.globalVariables.put(item);
    return item.id;
  }

  async updateGlobal(id: string, updates: Partial<EnvironmentVariable>): Promise<void> {
    await this.database.globalVariables.update(id, updates);
  }

  async deleteGlobal(id: string): Promise<void> {
    await this.database.globalVariables.delete(id);
  }

  async setAllGlobal(variables: EnvironmentVariable[]): Promise<void> {
    await this.database.transaction('rw', this.database.globalVariables, async () => {
      await this.database.globalVariables.clear();
      await this.database.globalVariables.bulkAdd(
        variables.map((v) => ({ ...v, scope: 'global' }))
      );
    });
  }
}

export const variableRepository = new VariableRepository();
