import { create } from 'zustand';
import {
  DatabaseConnectionProfile,
  DatabaseSchemaSnapshot,
  SqlQueryHistoryItem,
  SqlQueryResult,
} from '../types';
import { db } from '../database/database';
import {
  cancelDatabaseQuery,
  executeDatabaseSqlQuery,
  inspectDatabaseProfileSchema,
  saveProfileSecretToKeyring,
  testDatabaseProfileConnection,
} from '../services/database/dbToolsService';

interface DbToolsState {
  profiles: DatabaseConnectionProfile[];
  activeProfileId: string | null;
  schemaSnapshot: DatabaseSchemaSnapshot | null;
  queryHistory: SqlQueryHistoryItem[];
  lastResult: SqlQueryResult | null;
  activeQueryId: string | null;
  isExecuting: boolean;
  isInspecting: boolean;
  statusMessage: string | null;
  error: string | null;

  loadDbTools: () => Promise<void>;
  selectProfile: (profileId: string) => void;
  saveProfile: (
    profile: DatabaseConnectionProfile,
    plainPassword?: string
  ) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  testConnection: (profile: DatabaseConnectionProfile) => Promise<string>;
  inspectSchema: (profile: DatabaseConnectionProfile) => Promise<void>;
  runQuery: (params: {
    profile: DatabaseConnectionProfile;
    sql: string;
    readOnly: boolean;
    confirmDestructive: boolean;
    maxRows: number;
    timeoutMs: number;
  }) => Promise<SqlQueryResult>;
  cancelActiveQuery: () => Promise<void>;
}

export const useDbToolsStore = create<DbToolsState>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  schemaSnapshot: null,
  queryHistory: [],
  lastResult: null,
  activeQueryId: null,
  isExecuting: false,
  isInspecting: false,
  statusMessage: null,
  error: null,

  loadDbTools: async () => {
    const [profiles, queryHistory] = await Promise.all([
      db.databaseConnectionProfiles.orderBy('updatedAt').reverse().toArray(),
      db.queryHistory.orderBy('executedAt').reverse().toArray(),
    ]);
    set({
      profiles,
      queryHistory,
      activeProfileId: get().activeProfileId || profiles[0]?.id || null,
    });
  },

  selectProfile: (profileId) => set({ activeProfileId: profileId, schemaSnapshot: null }),

  saveProfile: async (profile, plainPassword) => {
    let credentialRef = profile.credentialRef;
    if (plainPassword && plainPassword.trim()) {
      credentialRef = await saveProfileSecretToKeyring(profile.name, plainPassword);
    }
    // Never write password text into Dexie or SQLite
    const sanitized: DatabaseConnectionProfile = {
      ...profile,
      credentialRef,
      updatedAt: Date.now(),
    };
    await db.databaseConnectionProfiles.put(sanitized);
    await get().loadDbTools();
    set({ activeProfileId: sanitized.id });
  },

  deleteProfile: async (profileId) => {
    await db.databaseConnectionProfiles.delete(profileId);
    await db.queryHistory.where('profileId').equals(profileId).delete();
    await get().loadDbTools();
  },

  testConnection: async (profile) => {
    set({ error: null, statusMessage: null });
    try {
      const msg = await testDatabaseProfileConnection(profile);
      set({ statusMessage: msg });
      return msg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      set({ error: msg });
      throw err;
    }
  },

  inspectSchema: async (profile) => {
    set({ isInspecting: true, error: null });
    try {
      const snap = await inspectDatabaseProfileSchema(profile);
      set({ isInspecting: false, schemaSnapshot: snap });
    } catch (err) {
      set({
        isInspecting: false,
        error: err instanceof Error ? err.message : 'Schema inspection failed',
      });
    }
  },

  runQuery: async (params) => {
    const queryId = `sqlq-${Date.now()}`;
    set({ isExecuting: true, error: null, activeQueryId: queryId });
    const startedAt = Date.now();
    try {
      const result = await executeDatabaseSqlQuery({ queryId, ...params });
      const histItem: SqlQueryHistoryItem = {
        id: `qh-${startedAt}`,
        profileId: params.profile.id,
        sql: params.sql,
        executedAt: startedAt,
        durationMs: result.durationMs,
        rowCount: result.rowCount,
        success: true,
        readOnlyMode: params.readOnly,
      };
      await db.queryHistory.put(histItem);
      set((s) => ({
        isExecuting: false,
        activeQueryId: null,
        lastResult: result,
        queryHistory: [histItem, ...s.queryHistory].slice(0, 100),
      }));
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query execution failed';
      const histItem: SqlQueryHistoryItem = {
        id: `qh-${startedAt}`,
        profileId: params.profile.id,
        sql: params.sql,
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
        rowCount: 0,
        success: false,
        errorMessage: msg,
        readOnlyMode: params.readOnly,
      };
      await db.queryHistory.put(histItem);
      set((s) => ({
        isExecuting: false,
        activeQueryId: null,
        error: msg,
        queryHistory: [histItem, ...s.queryHistory].slice(0, 100),
      }));
      throw err;
    }
  },

  cancelActiveQuery: async () => {
    const { activeQueryId } = get();
    if (activeQueryId) {
      await cancelDatabaseQuery(activeQueryId);
    }
  },
}));
