import { db, ApiStudioDatabase } from '../../database/database';
import { CollectionRepository } from '../../repositories/collectionRepository';
import { FolderRepository } from '../../repositories/folderRepository';
import { RequestRepository } from '../../repositories/requestRepository';
import { EnvironmentRepository } from '../../repositories/environmentRepository';
import { VariableRepository } from '../../repositories/variableRepository';
import { HistoryRepository } from '../../repositories/historyRepository';
import { SettingsRepository } from '../../repositories/settingsRepository';
import { BackupData, BackupMetadata } from '../../types';

export class BackupService {
  private colRepo: CollectionRepository;
  private fldRepo: FolderRepository;
  private reqRepo: RequestRepository;
  private envRepo: EnvironmentRepository;
  private varRepo: VariableRepository;
  private histRepo: HistoryRepository;
  private setRepo: SettingsRepository;

  constructor(private database: ApiStudioDatabase = db) {
    this.colRepo = new CollectionRepository(database);
    this.fldRepo = new FolderRepository(database);
    this.reqRepo = new RequestRepository(database);
    this.envRepo = new EnvironmentRepository(database);
    this.varRepo = new VariableRepository(database);
    this.histRepo = new HistoryRepository(database);
    this.setRepo = new SettingsRepository(database);
  }

  /**
   * Generates a complete API Studio backup package.
   */
  async createBackup(options: { includeHistory?: boolean; includeSecrets?: boolean } = {}): Promise<BackupData & { version: number }> {
    const [collections, folders, requests, environments, globalVariables, settings, history] =
      await Promise.all([
        this.colRepo.getAll(),
        this.fldRepo.getAll(),
        this.reqRepo.getAll(),
        this.envRepo.getAll(),
        this.varRepo.getAllGlobal(),
        this.setRepo.get(),
        options.includeHistory ? this.histRepo.getAll() : Promise.resolve([]),
      ]);

    // Sanitize secrets if includeSecrets is false
    const sanitizedEnvironments = options.includeSecrets
      ? environments
      : environments.map((env) => ({
          ...env,
          variables: env.variables.map((v) =>
            v.isSecret || v.secret ? { ...v, currentValue: '', initialValue: '' } : v
          ),
        }));

    const sanitizedGlobals = options.includeSecrets
      ? globalVariables
      : globalVariables.map((v) =>
          v.isSecret || v.secret ? { ...v, currentValue: '', initialValue: '' } : v
        );

    const sanitizedCollections = options.includeSecrets
      ? collections
      : collections.map((c) => ({
          ...c,
          variables: c.variables?.map((v) =>
            v.isSecret || v.secret ? { ...v, currentValue: '', initialValue: '' } : v
          ),
        }));

    const now = Date.now();
    const metadata: BackupMetadata = {
      backupVersion: 1,
      appVersion: '2.0.0',
      appName: 'API Studio',
      exportedAt: new Date(now).toISOString(),
      timestamp: now,
      schemaVersion: 1,
      includesSecrets: !!options.includeSecrets,
      counts: {
        collections: collections.length,
        folders: folders.length,
        requests: requests.length,
        environments: environments.length,
        globalVariables: globalVariables.length,
        history: history.length,
      },
    };

    return {
      version: 1,
      metadata,
      collections: sanitizedCollections,
      folders,
      requests,
      environments: sanitizedEnvironments,
      globalVariables: sanitizedGlobals,
      settings,
      history: options.includeHistory ? history : undefined,
    };
  }

  /**
   * Validates if parsed JSON is a valid API Studio backup file.
   */
  validateBackup(json: any): { valid: boolean; isValid: boolean; errors: string[]; metadata?: BackupMetadata } {
    const errors: string[] = [];

    if (!json || typeof json !== 'object') {
      return { valid: false, isValid: false, errors: ['File is not a valid JSON object.'] };
    }
    if (!json.metadata || typeof json.metadata !== 'object') {
      errors.push('Backup is missing metadata section.');
    }
    if (!Array.isArray(json.collections)) {
      errors.push('Backup is missing collections array.');
    }
    if (!Array.isArray(json.requests)) {
      errors.push('Backup is missing requests array.');
    }

    const isValid = errors.length === 0;
    return {
      valid: isValid,
      isValid,
      errors,
      metadata: json.metadata,
    };
  }

  /**
   * Restores data from a validated backup package into IndexedDB.
   */
  async restoreBackup(
    backup: BackupData,
    options: {
      mode?: 'merge' | 'overwrite';
      entities?: {
        collections?: boolean;
        environments?: boolean;
        globalVariables?: boolean;
        settings?: boolean;
        history?: boolean;
      };
      sections?: {
        collections?: boolean;
        environments?: boolean;
        globalVariables?: boolean;
        settings?: boolean;
        history?: boolean;
      };
    } = {}
  ): Promise<void> {
    const mode = options.mode || 'merge';
    const activeSections = options.entities || options.sections || {
      collections: true,
      environments: true,
      globalVariables: true,
      settings: true,
      history: true,
    };

    await this.database.transaction(
      'rw',
      [
        this.database.collections,
        this.database.folders,
        this.database.requests,
        this.database.environments,
        this.database.globalVariables,
        this.database.settings,
        this.database.history,
      ],
      async () => {
        if (activeSections.collections) {
          if (mode === 'overwrite') {
            await this.database.collections.clear();
            await this.database.folders.clear();
            await this.database.requests.clear();
          }
          if (backup.collections?.length) await this.database.collections.bulkPut(backup.collections);
          if (backup.folders?.length) await this.database.folders.bulkPut(backup.folders);
          if (backup.requests?.length) await this.database.requests.bulkPut(backup.requests);
        }

        if (activeSections.environments && backup.environments?.length) {
          if (mode === 'overwrite') await this.database.environments.clear();
          await this.database.environments.bulkPut(backup.environments);
        }

        if (activeSections.globalVariables && backup.globalVariables?.length) {
          if (mode === 'overwrite') await this.database.globalVariables.clear();
          await this.database.globalVariables.bulkPut(backup.globalVariables);
        }

        if (activeSections.settings && backup.settings) {
          if (Array.isArray(backup.settings)) {
            if (backup.settings.length > 0) {
              await this.database.settings.bulkPut(backup.settings);
            }
          } else if ((backup.settings as any).id) {
            await this.database.settings.put(backup.settings);
          }
        }

        if (activeSections.history && backup.history?.length) {
          if (mode === 'overwrite') await this.database.history.clear();
          await this.database.history.bulkPut(backup.history);
        }
      }
    );
  }
}

export const backupService = new BackupService();
