export const DATABASE_NAME = 'ApiStudioDB';
export const CURRENT_DATABASE_VERSION = 4;

export const DB_SCHEMA_V1 = {
  collections: 'id, name, order, createdAt, updatedAt',
  folders: 'id, collectionId, parentId, name, order, createdAt, updatedAt',
  requests: 'id, collectionId, folderId, name, method, order, createdAt, updatedAt',
  environments: 'id, name, isDefault, order, createdAt, updatedAt',
  globalVariables: 'id, key, enabled, isSecret',
  history: 'id, requestId, method, status, timestamp, timeMs',
  settings: 'id, updatedAt',
};

export const DB_SCHEMA_V2 = {
  ...DB_SCHEMA_V1,
  testSuites: 'id, name, folder, collectionId, createdAt, updatedAt',
  testReports: 'id, name, sourceType, sourceId, status, startedAt, createdAt',
  scriptTemplates: 'id, name, category, stage, isBuiltIn, createdAt, updatedAt',
  jsonSchemas: 'id, name, createdAt, updatedAt',
  assertionConfigurations: 'id, name, createdAt, updatedAt',
};

export const DB_SCHEMA_V3 = {
  ...DB_SCHEMA_V2,
  protocolConfigs: 'id, requestId, protocol, name, updatedAt',
  wsMessageTemplates: 'id, name, format, updatedAt',
  sseEventLogs: 'id, requestId, sessionId, timestamp',
  comparisonSessions: 'id, name, createdAt, updatedAt',
  developerToolPreferences: 'id, updatedAt',
};

export const DB_SCHEMA_V4 = {
  ...DB_SCHEMA_V3,
  workspaces: 'id, name, type, isPinned, updatedAt',
  projects: 'id, workspaceId, name, isPinned, lastOpenedAt, updatedAt',
  apiSpecs: 'id, projectId, workspaceId, name, version, format, updatedAt',
  apiVersions: 'id, specId, versionLabel, isActive, isArchived, updatedAt',
  documentationConfigs: 'id, specId, updatedAt',
  mockServers: 'id, projectId, name, port, updatedAt',
  mockEndpoints: 'id, serverId, method, path, enabled',
  mockRequestLogs: 'id, serverId, timestamp, method, responseStatus',
  contractConfigs: 'id, specId, environmentId, updatedAt',
  contractReports: 'id, specId, status, startedAt, completedAt',
  gitRepos: 'id, projectId, repoPath, currentBranch, updatedAt',
  workspaceMembers: 'id, workspaceId, email, role',
  collaborationComments: 'id, workspaceId, targetType, targetId, createdAt',
  activityLogs: 'id, workspaceId, projectId, timestamp',
  syncMetadata: 'id, workspaceId, status',
};
