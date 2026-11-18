import { db, ApiStudioDatabase } from '../database/database';
import { ScriptTemplate } from '../types';
import { BUILT_IN_SCRIPT_TEMPLATES } from '../services/scripting/builtInTemplates';

export class ScriptTemplateRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAll(): Promise<ScriptTemplate[]> {
    const list = await this.database.scriptTemplates.toArray();
    if (list.length === 0) {
      await this.database.scriptTemplates.bulkPut(BUILT_IN_SCRIPT_TEMPLATES);
      return [...BUILT_IN_SCRIPT_TEMPLATES];
    }
    return list.sort((a, b) => Number(b.isBuiltIn) - Number(a.isBuiltIn) || b.updatedAt - a.updatedAt);
  }

  async save(template: ScriptTemplate): Promise<string> {
    return this.database.scriptTemplates.put({
      ...template,
      updatedAt: Date.now(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.scriptTemplates.delete(id);
  }
}

export const scriptTemplateRepository = new ScriptTemplateRepository();
