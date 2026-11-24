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
  WorkspaceRecord,
  ProjectRecord,
  OpenApiSpecRecord,
  ApiVersionEntry,
  DocumentationConfig,
  MockServerConfig,
  MockEndpointRule,
  MockRequestLog,
  ContractTestConfig,
  ContractTestReport,
  GitRepoConfig,
  WorkspaceMember,
  CollaborationComment,
  ActivityLogEntry,
  SyncMetadata,
} from '../types';
import {
  DATABASE_NAME,
  DB_SCHEMA_V1,
  DB_SCHEMA_V2,
  DB_SCHEMA_V3,
  DB_SCHEMA_V4,
} from './schema';

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

  // Phase 8 tables
  workspaces!: Table<WorkspaceRecord, string>;
  projects!: Table<ProjectRecord, string>;
  apiSpecs!: Table<OpenApiSpecRecord, string>;
  apiVersions!: Table<ApiVersionEntry, string>;
  documentationConfigs!: Table<DocumentationConfig, string>;
  mockServers!: Table<MockServerConfig, string>;
  mockEndpoints!: Table<MockEndpointRule, string>;
  mockRequestLogs!: Table<MockRequestLog, string>;
  contractConfigs!: Table<ContractTestConfig, string>;
  contractReports!: Table<ContractTestReport, string>;
  gitRepos!: Table<GitRepoConfig, string>;
  workspaceMembers!: Table<WorkspaceMember, string>;
  collaborationComments!: Table<CollaborationComment, string>;
  activityLogs!: Table<ActivityLogEntry, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor(dbName = DATABASE_NAME) {
    super(dbName);
    this.version(1).stores(DB_SCHEMA_V1);
    this.version(2).stores(DB_SCHEMA_V2);
    this.version(3).stores(DB_SCHEMA_V3);
    this.version(4).stores(DB_SCHEMA_V4);
  }
}

export const db = new ApiStudioDatabase();
