import Dexie, { type Table } from 'dexie';
import {
  CollectionDefinition,
  FolderDefinition,
  ApiRequest,
  Environment,
  EnvironmentVariable,
  HistoryItem,
  ApplicationSettings,
  TestSuite,
  TestReport,
  ScriptTemplate,
  SavedJsonSchema,
  AssertionConfiguration,
  SavedProtocolConfig,
  WebSocketMessageTemplate,
  SavedSseEventMetadata,
  ComparisonSession,
  DeveloperToolPreferences,
} from '../types';
import { DATABASE_NAME, DB_SCHEMA_V1, DB_SCHEMA_V2, DB_SCHEMA_V3 } from './schema';

// In Node.js / test environments, ensure indexedDB is available via fake-indexeddb
if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
  try {
    const fake = require('fake-indexeddb');
    if (fake && !globalThis.indexedDB) {
      globalThis.indexedDB = fake.indexedDB;
      globalThis.IDBKeyRange = fake.IDBKeyRange;
    }
  } catch {
    // browser or already polyfilled
  }
}

export class ApiStudioDatabase extends Dexie {
  collections!: Table<CollectionDefinition, string>;
  folders!: Table<FolderDefinition, string>;
  requests!: Table<ApiRequest, string>;
  environments!: Table<Environment, string>;
  globalVariables!: Table<EnvironmentVariable, string>;
  history!: Table<HistoryItem, string>;
  settings!: Table<ApplicationSettings, string>;

  // Phase 5 tables
  testSuites!: Table<TestSuite, string>;
  testReports!: Table<TestReport, string>;
  scriptTemplates!: Table<ScriptTemplate, string>;
  jsonSchemas!: Table<SavedJsonSchema, string>;
  assertionConfigurations!: Table<AssertionConfiguration, string>;

  // Phase 6 tables
  protocolConfigs!: Table<SavedProtocolConfig, string>;
  wsMessageTemplates!: Table<WebSocketMessageTemplate, string>;
  sseEventLogs!: Table<SavedSseEventMetadata, string>;
  comparisonSessions!: Table<ComparisonSession, string>;
  developerToolPreferences!: Table<DeveloperToolPreferences, string>;

  constructor(dbName = DATABASE_NAME) {
    super(dbName);
    this.version(1).stores(DB_SCHEMA_V1);
    this.version(2).stores(DB_SCHEMA_V2);
    this.version(3).stores(DB_SCHEMA_V3);
  }
}

export const db = new ApiStudioDatabase();
