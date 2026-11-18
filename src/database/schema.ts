export const DATABASE_NAME = 'ApiStudioDB';
export const CURRENT_DATABASE_VERSION = 2;

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
