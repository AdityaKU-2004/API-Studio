export const DATABASE_NAME = 'ApiStudioDB';
export const CURRENT_DATABASE_VERSION = 1;

export const DB_SCHEMA_V1 = {
  collections: 'id, name, order, createdAt, updatedAt',
  folders: 'id, collectionId, parentId, name, order, createdAt, updatedAt',
  requests: 'id, collectionId, folderId, name, method, order, createdAt, updatedAt',
  environments: 'id, name, isDefault, order, createdAt, updatedAt',
  globalVariables: 'id, key, enabled, isSecret',
  history: 'id, requestId, method, status, timestamp, timeMs',
  settings: 'id, updatedAt',
};
