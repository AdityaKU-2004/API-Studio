import { open, save } from '@tauri-apps/plugin-dialog';
import { db } from '../../database/database';
import {
  DatabaseStatus,
  IndexedDbInspectionSummary,
  MigrationReport,
} from '../../types';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from './tauriBridge';

export class DesktopDatabaseService {
  public async getStatus(): Promise<DatabaseStatus> {
    return invokeDesktop<DatabaseStatus>('db_status');
  }

  public async listEntities<T>(entity: string): Promise<T[]> {
    return invokeDesktop<T[]>('db_list_entities', { entity });
  }

  public async saveEntity<T>(entity: string, item: T): Promise<void> {
    return invokeDesktop<void>('db_save_entity', { entity, item });
  }

  public async deleteEntity(entity: string, id: string): Promise<boolean> {
    return invokeDesktop<boolean>('db_delete_entity', { entity, id });
  }

  public async inspectIndexedDb(): Promise<IndexedDbInspectionSummary> {
    const [
      collections,
      folders,
      requests,
      environments,
      globalVariables,
      history,
      testSuites,
      testReports,
      scriptTemplates,
      jsonSchemas,
      protocolConfigs,
    ] = await Promise.all([
      db.collections.count(),
      db.folders.count(),
      db.requests.count(),
      db.environments.count(),
      db.globalVariables.count(),
      db.history.count(),
      db.testSuites.count(),
      db.testReports.count(),
      db.scriptTemplates.count(),
      db.jsonSchemas.count(),
      db.protocolConfigs.count(),
    ]);

    const totalRecords =
      collections +
      folders +
      requests +
      environments +
      globalVariables +
      history +
      testSuites +
      testReports +
      scriptTemplates +
      jsonSchemas +
      protocolConfigs;

    return {
      hasLegacyData: totalRecords > 0,
      totalRecords,
      counts: {
        collections,
        folders,
        requests,
        environments,
        globalVariables,
        history,
        testSuites,
        testReports,
        scriptTemplates,
        jsonSchemas,
        protocolConfigs,
      },
    };
  }

  public async buildMigrationPayload(
    conflictStrategy: 'skip' | 'overwrite' = 'overwrite'
  ): Promise<Record<string, unknown>> {
    const [
      collections,
      folders,
      requests,
      environments,
      globalVariables,
      history,
      settings,
      testSuites,
      testReports,
      scriptTemplates,
      jsonSchemas,
      assertionConfigurations,
      protocolConfigs,
      wsMessageTemplates,
      sseEventLogs,
      comparisonSessions,
      developerToolPreferences,
    ] = await Promise.all([
      db.collections.toArray(),
      db.folders.toArray(),
      db.requests.toArray(),
      db.environments.toArray(),
      db.globalVariables.toArray(),
      db.history.toArray(),
      db.settings.toArray(),
      db.testSuites.toArray(),
      db.testReports.toArray(),
      db.scriptTemplates.toArray(),
      db.jsonSchemas.toArray(),
      db.assertionConfigurations.toArray(),
      db.protocolConfigs.toArray(),
      db.wsMessageTemplates.toArray(),
      db.sseEventLogs.toArray(),
      db.comparisonSessions.toArray(),
      db.developerToolPreferences.toArray(),
    ]);

    return {
      collections,
      folders,
      requests,
      environments,
      globalVariables,
      history,
      settings,
      testSuites,
      testReports,
      scriptTemplates,
      jsonSchemas,
      assertionConfigurations,
      protocolConfigs,
      wsMessageTemplates,
      sseEventLogs,
      comparisonSessions,
      developerToolPreferences,
      conflictStrategy,
    };
  }

  public async migrateIndexedDbToSqlite(
    conflictStrategy: 'skip' | 'overwrite' = 'overwrite'
  ): Promise<MigrationReport> {
    const payload = await this.buildMigrationPayload(conflictStrategy);
    return invokeDesktop<MigrationReport>('db_import_indexeddb', { payload });
  }

  public async backupSqliteDatabase(): Promise<string | null> {
    if (!isTauriRuntime()) return null;
    const selected = await save({
      title: 'Backup API Studio SQLite Database',
      defaultPath: `api-studio-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
    });
    if (!selected) return null;
    return invokeDesktop<string>('db_backup', { destPath: selected });
  }

  public async restoreSqliteDatabase(): Promise<boolean> {
    if (!isTauriRuntime()) return false;
    const selected = await open({
      title: 'Restore API Studio SQLite Database',
      multiple: false,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
    });
    if (!selected || Array.isArray(selected)) return false;
    await invokeDesktop<void>('db_restore', { srcPath: selected });
    return true;
  }
}

export const desktopDatabaseService = new DesktopDatabaseService();
