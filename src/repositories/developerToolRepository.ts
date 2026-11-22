import { db, ApiStudioDatabase } from '../database/database';
import { DeveloperToolPreferences } from '../types';

const DEFAULT_PREFS_ID = 'default_dev_prefs';

export const DEFAULT_DEVELOPER_TOOL_PREFERENCES: DeveloperToolPreferences = {
  id: DEFAULT_PREFS_ID,
  lastActiveTool: 'json-formatter',
  jsonIndentSpaces: 2,
  tsRootInterfaceName: 'Root',
  uuidDefaultCount: 5,
  favoriteTools: ['json-formatter', 'jwt-decoder', 'json-to-ts'],
  updatedAt: Date.now(),
};

export class DeveloperToolRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getPreferences(): Promise<DeveloperToolPreferences> {
    const existing = await this.database.developerToolPreferences.get(DEFAULT_PREFS_ID);
    return existing || { ...DEFAULT_DEVELOPER_TOOL_PREFERENCES, updatedAt: Date.now() };
  }

  async savePreferences(updates: Partial<DeveloperToolPreferences>): Promise<DeveloperToolPreferences> {
    const current = await this.getPreferences();
    const merged: DeveloperToolPreferences = {
      ...current,
      ...updates,
      id: DEFAULT_PREFS_ID,
      updatedAt: Date.now(),
    };
    await this.database.developerToolPreferences.put(merged);
    return merged;
  }
}

export const developerToolRepository = new DeveloperToolRepository();
