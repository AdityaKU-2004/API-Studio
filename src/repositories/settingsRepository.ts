import { db, ApiStudioDatabase } from '../database/database';
import { ApplicationSettings } from '../types';

export const DEFAULT_SETTINGS: ApplicationSettings = {
  id: 'app_settings',
  theme: 'dark',
  sidebarWidth: 280,
  splitRatio: 52,
  activeWorkspaceId: 'ws-default',
  activeEnvironmentId: 'env-dev',
  historyRetentionLimit: 50,
  retainResponseBodiesInHistory: true,
  defaultTimeout: 10000,
  updatedAt: Date.now(),
};

export class SettingsRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async get(): Promise<ApplicationSettings> {
    const s = await this.database.settings.get('app_settings');
    return s || DEFAULT_SETTINGS;
  }

  async update(updates: Partial<ApplicationSettings>): Promise<ApplicationSettings> {
    const current = await this.get();
    const updated: ApplicationSettings = {
      ...current,
      ...updates,
      updatedAt: Date.now(),
    };
    await this.database.settings.put(updated);
    return updated;
  }
}

export const settingsRepository = new SettingsRepository();
