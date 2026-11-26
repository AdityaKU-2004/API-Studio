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
      apiSpecs,
      mockServers,
      workspaces,
      projects,
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
      db.apiSpecs.count(),
      db.mockServers.count(),
      db.workspaces.count(),
      db.projects.count(),
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
      protocolConfigs +
      apiSpecs +
      mockServers +
      workspaces +
      projects;

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
        apiSpecs,
        mockServers,
        workspaces,
        projects,
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
      workspaces,
      projects,
      apiSpecs,
      apiVersions,
      documentationConfigs,
      mockServers,
      mockEndpoints,
      mockRequestLogs,
      contractConfigs,
      contractReports,
      gitRepos,
      workspaceMembers,
      collaborationComments,
      activityLogs,
      syncMetadata,
      performanceTestConfigs,
      performanceTestRuns,
      performanceMetrics,
      securityAuditConfigs,
      securityFindings,
      monitoringConfigs,
      monitoringResults,
      alertConfigs,
      databaseConnectionProfiles,
      queryHistory,
      environmentValidationResults,
      dependencyGraphData,
      automationWorkflows,
      workflowExecutions,
      cliConfigurations,
      analyticsSnapshots,
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
      db.workspaces.toArray(),
      db.projects.toArray(),
      db.apiSpecs.toArray(),
      db.apiVersions.toArray(),
      db.documentationConfigs.toArray(),
      db.mockServers.toArray(),
      db.mockEndpoints.toArray(),
      db.mockRequestLogs.toArray(),
      db.contractConfigs.toArray(),
      db.contractReports.toArray(),
      db.gitRepos.toArray(),
      db.workspaceMembers.toArray(),
      db.collaborationComments.toArray(),
      db.activityLogs.toArray(),
      db.syncMetadata.toArray(),
      db.performanceTestConfigs.toArray(),
      db.performanceTestRuns.toArray(),
      db.performanceMetrics.toArray(),
      db.securityAuditConfigs.toArray(),
      db.securityFindings.toArray(),
      db.monitoringConfigs.toArray(),
      db.monitoringResults.toArray(),
      db.alertConfigs.toArray(),
      db.databaseConnectionProfiles.toArray(),
      db.queryHistory.toArray(),
      db.environmentValidationResults.toArray(),
      db.dependencyGraphData.toArray(),
      db.automationWorkflows.toArray(),
      db.workflowExecutions.toArray(),
      db.cliConfigurations.toArray(),
      db.analyticsSnapshots.toArray(),
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
      workspaces,
      projects,
      apiSpecs,
      apiVersions,
      documentationConfigs,
      mockServers,
      mockEndpoints,
      mockRequestLogs,
      contractConfigs,
      contractReports,
      gitRepos,
      workspaceMembers,
      collaborationComments,
      activityLogs,
      syncMetadata,
      performanceTestConfigs,
      performanceTestRuns,
      performanceMetrics,
      securityAuditConfigs,
      securityFindings,
      monitoringConfigs,
      monitoringResults,
      alertConfigs,
      databaseConnectionProfiles,
      queryHistory,
      environmentValidationResults,
      dependencyGraphData,
      automationWorkflows,
      workflowExecutions,
      cliConfigurations,
      analyticsSnapshots,
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
