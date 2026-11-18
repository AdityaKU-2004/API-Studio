import { db, ApiStudioDatabase } from '../database/database';
import { SavedJsonSchema } from '../types';

export class JsonSchemaRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<SavedJsonSchema[]> {
    return this.database.jsonSchemas.orderBy('updatedAt').reverse().toArray();
  }

  async getById(id: string): Promise<SavedJsonSchema | undefined> {
    return this.database.jsonSchemas.get(id);
  }

  async save(schema: SavedJsonSchema): Promise<string> {
    return this.database.jsonSchemas.put({
      ...schema,
      updatedAt: Date.now(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.jsonSchemas.delete(id);
  }
}

export const jsonSchemaRepository = new JsonSchemaRepository();
