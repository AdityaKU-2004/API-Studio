import Dexie, { type Table } from 'dexie';
import {
  CollectionDefinition,
  FolderDefinition,
  ApiRequest,
  Environment,
  EnvironmentVariable,
  HistoryItem,
  ApplicationSettings,
} from '../types';
import { DATABASE_NAME, CURRENT_DATABASE_VERSION, DB_SCHEMA_V1 } from './schema';

// In Node.js / test environments, ensure indexedDB is available via fake-indexeddb
if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
  try {
    const fake = require('fake-indexeddb');
    if (fake && !globalThis.indexedDB) {
      // @ts-expect-error fake-indexeddb polyfill
      globalThis.indexedDB = fake.indexedDB;
      // @ts-expect-error fake-indexeddb polyfill
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

  constructor(dbName = DATABASE_NAME) {
    super(dbName);
    this.version(CURRENT_DATABASE_VERSION).stores(DB_SCHEMA_V1);
  }
}

export const db = new ApiStudioDatabase();
