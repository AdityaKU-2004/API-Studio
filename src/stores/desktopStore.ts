import { create } from 'zustand';
import {
  DatabaseStatus,
  DiagnosticLogEntry,
  IndexedDbInspectionSummary,
  KeyringStatus,
  MigrationReport,
  NativeProxyConfig,
  RuntimeCapabilities,
} from '../types';
import { detectRuntimeCapabilities } from '../services/runtime/capabilities';
import { desktopDatabaseService } from '../services/desktop/databaseService';
import { desktopSecurityService } from '../services/desktop/securityService';
import { desktopDiagnosticsService } from '../services/desktop/diagnosticsService';

const DEFAULT_PROXY_CONFIG: NativeProxyConfig = {
  enabled: false,
  protocol: 'http',
  host: '127.0.0.1',
  port: 8888,
  username: '',
  password: '',
  bypassList: ['localhost', '127.0.0.1'],
};

interface DesktopState {
  capabilities: RuntimeCapabilities;
  dbStatus: DatabaseStatus | null;
  keyringStatus: KeyringStatus | null;
  globalProxy: NativeProxyConfig;
  defaultVerifySsl: boolean;
  diagnosticLogs: DiagnosticLogEntry[];

  // Migration wizard state
  isMigrationModalOpen: boolean;
  migrationChecked: boolean;
  indexedDbSummary: IndexedDbInspectionSummary | null;
  migrationStatus: 'idle' | 'backing-up' | 'migrating' | 'completed' | 'error';
  migrationProgressLabel: string;
  migrationReport: MigrationReport | null;
  migrationError: string | null;

  initializeDesktopRuntime: () => Promise<void>;
  refreshDbStatus: () => Promise<void>;
  refreshKeyringStatus: () => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
  updateGlobalProxy: (config: NativeProxyConfig) => Promise<void>;
  setDefaultVerifySsl: (verify: boolean) => void;
  setMigrationModalOpen: (open: boolean) => void;
  runIndexedDbMigration: (options?: {
    createBackupFirst?: boolean;
    conflictStrategy?: 'skip' | 'overwrite';
  }) => Promise<void>;
  backupDatabase: () => Promise<string | null>;
  restoreDatabase: () => Promise<boolean>;
}

const MIGRATION_COMPLETED_FLAG = 'api_studio_sqlite_migration_done';

export const useDesktopStore = create<DesktopState>((set, get) => ({
  capabilities: detectRuntimeCapabilities(),
  dbStatus: null,
  keyringStatus: null,
  globalProxy: DEFAULT_PROXY_CONFIG,
  defaultVerifySsl: true,
  diagnosticLogs: [],

  isMigrationModalOpen: false,
  migrationChecked: false,
  indexedDbSummary: null,
  migrationStatus: 'idle',
  migrationProgressLabel: '',
  migrationReport: null,
  migrationError: null,

  initializeDesktopRuntime: async () => {
    const caps = detectRuntimeCapabilities();
    set({ capabilities: caps });

    if (!caps.isDesktop) {
      set({ migrationChecked: true });
      return;
    }

    try {
      const [dbStatus, keyringStatus, logs] = await Promise.all([
        desktopDatabaseService.getStatus().catch(() => null),
        desktopSecurityService.getKeyringStatus().catch(() => null),
        desktopDiagnosticsService.getLogs().catch(() => []),
      ]);

      const storedProxyRaw = localStorage.getItem('api_studio_global_proxy');
      if (storedProxyRaw) {
        try {
          const parsed = JSON.parse(storedProxyRaw) as NativeProxyConfig;
          // Restore password from OS keyring if credentialRef exists
          if (parsed.credentialRef) {
            const secret = await desktopSecurityService
              .getSecret(parsed.credentialRef)
              .catch(() => null);
            if (secret) parsed.password = secret;
          }
          await desktopSecurityService.setGlobalProxyConfig(parsed).catch(() => {});
          set({ globalProxy: parsed });
        } catch {
          // ignore
        }
      }

      // Check if IndexedDB contains legacy records and SQLite is empty & not yet migrated
      const sqliteTotal = dbStatus
        ? Object.values(dbStatus.tableCounts || {}).reduce((a, b) => a + b, 0)
        : 0;
      const alreadyDone = localStorage.getItem(MIGRATION_COMPLETED_FLAG) === 'true';
      const idbSummary = await desktopDatabaseService.inspectIndexedDb().catch(() => null);

      set({
        dbStatus,
        keyringStatus,
        diagnosticLogs: logs,
        indexedDbSummary: idbSummary,
        migrationChecked: true,
        isMigrationModalOpen:
          Boolean(idbSummary?.hasLegacyData) && sqliteTotal === 0 && !alreadyDone,
      });
    } catch {
      set({ migrationChecked: true });
    }
  },

  refreshDbStatus: async () => {
    if (!get().capabilities.isDesktop) return;
    const dbStatus = await desktopDatabaseService.getStatus().catch(() => null);
    set({ dbStatus });
  },

  refreshKeyringStatus: async () => {
    if (!get().capabilities.isDesktop) return;
    const keyringStatus = await desktopSecurityService.getKeyringStatus().catch(() => null);
    set({ keyringStatus });
  },

  refreshDiagnostics: async () => {
    if (!get().capabilities.isDesktop) return;
    const diagnosticLogs = await desktopDiagnosticsService.getLogs().catch(() => []);
    set({ diagnosticLogs });
  },

  updateGlobalProxy: async (config) => {
    const cleanToPersist: NativeProxyConfig = { ...config };
    if (get().capabilities.isDesktop) {
      if (config.password && config.password.trim()) {
        const refId =
          config.credentialRef ||
          (await desktopSecurityService.generateCredentialRef('global_proxy'));
        await desktopSecurityService.storeSecret(refId, config.password);
        cleanToPersist.credentialRef = refId;
        // Never keep raw proxy password inside localStorage
        cleanToPersist.password = '';
      }
      await desktopSecurityService.setGlobalProxyConfig(config);
    }
    localStorage.setItem('api_studio_global_proxy', JSON.stringify(cleanToPersist));
    set({ globalProxy: cleanToPersist });
  },

  setDefaultVerifySsl: (verify) => {
    set({ defaultVerifySsl: verify });
  },

  setMigrationModalOpen: (open) => {
    set({ isMigrationModalOpen: open });
  },

  runIndexedDbMigration: async (options = {}) => {
    const conflictStrategy = options.conflictStrategy || 'overwrite';
    try {
      if (options.createBackupFirst) {
        set({
          migrationStatus: 'backing-up',
          migrationProgressLabel: 'Exporting pre-migration IndexedDB safety snapshot...',
          migrationError: null,
        });
        const payload = await desktopDatabaseService.buildMigrationPayload(conflictStrategy);
        const { desktopFileService } = await import('../services/desktop/fileService');
        await desktopFileService.saveTextFile(
          `api-studio-pre-migration-backup-${new Date().toISOString().slice(0, 10)}.json`,
          JSON.stringify(payload, null, 2)
        );
      }

      set({
        migrationStatus: 'migrating',
        migrationProgressLabel: 'Writing validated IndexedDB collections & data into SQLite...',
        migrationError: null,
      });

      const report = await desktopDatabaseService.migrateIndexedDbToSqlite(conflictStrategy);
      const dbStatus = await desktopDatabaseService.getStatus().catch(() => null);
      localStorage.setItem(MIGRATION_COMPLETED_FLAG, 'true');

      set({
        migrationStatus: 'completed',
        migrationProgressLabel: `Migrated cleanly in ${report.durationMs}ms (IndexedDB preserved).`,
        migrationReport: report,
        dbStatus,
      });
    } catch (err) {
      set({
        migrationStatus: 'error',
        migrationProgressLabel: '',
        migrationError: err instanceof Error ? err.message : 'IndexedDB to SQLite migration failed.',
      });
    }
  },

  backupDatabase: async () => {
    return desktopDatabaseService.backupSqliteDatabase();
  },

  restoreDatabase: async () => {
    const ok = await desktopDatabaseService.restoreSqliteDatabase();
    if (ok) {
      await get().refreshDbStatus();
    }
    return ok;
  },
}));
