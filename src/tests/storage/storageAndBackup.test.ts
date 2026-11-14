import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ApiStudioDatabase } from '../../database/database';
import { StorageService } from '../../services/storage/storageService';
import { BackupService } from '../../services/storage/backupService';
import { CollectionExporter } from '../../services/collections/collectionExporter';
import { CollectionImporter } from '../../services/collections/collectionImporter';
import { CollectionDefinition, FolderDefinition, ApiRequest, Environment } from '../../types';

describe('Phase 4: Storage, Inheritance, Backup, and Import/Export', () => {
  let testDb: ApiStudioDatabase;
  let storage: StorageService;
  let backup: BackupService;
  let exporter: CollectionExporter;
  let importer: CollectionImporter;

  beforeEach(async () => {
    testDb = new ApiStudioDatabase();
    await testDb.open();
    await Promise.all([
      testDb.collections.clear(),
      testDb.folders.clear(),
      testDb.requests.clear(),
      testDb.environments.clear(),
      testDb.globalVariables.clear(),
      testDb.history.clear(),
      testDb.settings.clear(),
    ]);

    storage = new StorageService(testDb);
    backup = new BackupService(testDb);
    exporter = new CollectionExporter(testDb);
    importer = new CollectionImporter(testDb);
  });

  it('builds a hierarchical collection tree with folders and requests', async () => {
    await testDb.collections.add({
      id: 'col-main',
      name: 'Main API',
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    await testDb.folders.add({
      id: 'fld-users',
      collectionId: 'col-main',
      parentId: null,
      name: 'Users Folder',
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    await testDb.requests.add({
      id: 'req-list-users',
      collectionId: 'col-main',
      folderId: 'fld-users',
      name: 'List Users',
      method: 'GET',
      url: 'https://api.test/users',
      params: [],
      headers: [],
      bodyType: 'none',
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    const tree = await storage.buildCollectionTree();
    expect(tree.length).toBeGreaterThan(0);
    const mainCol = tree.find((c) => c.id === 'col-main');
    expect(mainCol).toBeDefined();
    expect(mainCol?.children?.length).toBe(1);
    expect(mainCol?.children?.[0].type).toBe('folder');
    expect(mainCol?.children?.[0].children?.[0].type).toBe('request');
    expect(mainCol?.children?.[0].children?.[0].name).toBe('List Users');
  });

  it('resolves inherited authentication and shared collection headers', async () => {
    // Collection with bearer auth and shared headers
    await testDb.collections.add({
      id: 'col-secure',
      name: 'Secure API',
      auth: { type: 'bearer', bearer: { token: 'col-token-abc' } },
      headers: [
        { id: 'h1', key: 'X-App-Id', value: 'my-app', enabled: true },
        { id: 'h2', key: 'Accept', value: 'application/json', enabled: true },
      ],
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    // Request with auth: { type: 'inherit' } and overriding Accept header
    const req: ApiRequest = {
      id: 'req-secure-1',
      collectionId: 'col-secure',
      name: 'Get Data',
      method: 'GET',
      url: 'https://api.test/data',
      auth: { type: 'inherit' },
      headers: [
        { id: 'h3', key: 'Accept', value: 'application/xml', enabled: true }, // Overrides collection header
      ],
      params: [],
      bodyType: 'none',
      createdAt: 1,
      updatedAt: 1,
    };
    await testDb.requests.add(req);

    const effective = await storage.resolveEffectiveConfiguration(req);

    // Auth should be inherited from collection
    expect(effective.effectiveAuth.type).toBe('bearer');
    expect(effective.effectiveAuth.bearer?.token).toBe('col-token-abc');

    // Headers: X-App-Id is inherited, Accept is overridden by the request
    const acceptHeader = effective.effectiveHeaders.find((h) => h.key.toLowerCase() === 'accept');
    expect(acceptHeader?.value).toBe('application/xml');

    const appHeader = effective.effectiveHeaders.find((h) => h.key.toLowerCase() === 'x-app-id');
    expect(appHeader?.value).toBe('my-app');
  });

  it('creates and validates full application backups, sanitizing secrets when requested', async () => {
    await testDb.collections.add({
      id: 'col-backup',
      name: 'Col Backup',
      variables: [{ id: 'v1', key: 'secret_key', initialValue: 'ultra-secret', isSecret: true, enabled: true }],
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    // Backup WITHOUT secrets
    const sanitizedBackup = await backup.createBackup({ includeSecrets: false });
    expect(sanitizedBackup.version).toBe(1);
    expect(sanitizedBackup.collections[0].variables?.[0].initialValue).toBe('');

    // Backup WITH secrets
    const fullBackup = await backup.createBackup({ includeSecrets: true });
    expect(fullBackup.collections[0].variables?.[0].initialValue).toBe('ultra-secret');

    // Validate backup
    const validation = backup.validateBackup(fullBackup);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('restores application state from backup in merge and overwrite modes', async () => {
    const backupPayload = {
      version: 1,
      metadata: {
        createdAt: Date.now(),
        appVersion: '2.0.0',
        platform: 'web',
      },
      collections: [
        { id: 'c-restored', name: 'Restored Collection', order: 1, createdAt: 1, updatedAt: 1 },
      ],
      folders: [],
      requests: [
        {
          id: 'r-restored',
          collectionId: 'c-restored',
          name: 'Restored Req',
          method: 'GET' as const,
          url: 'https://api.test/ping',
          params: [],
          headers: [],
          bodyType: 'none' as const,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      environments: [
        { id: 'env-restored', name: 'Restored Env', variables: [], createdAt: 1, updatedAt: 1 },
      ],
      globalVariables: [],
      history: [],
      settings: [],
    };

    // Restore into database
    await backup.restoreBackup(backupPayload as any, {
      mode: 'overwrite',
      entities: { collections: true, environments: true, globalVariables: true, history: true, settings: true },
    });

    const collections = await testDb.collections.toArray();
    expect(collections.length).toBe(1);
    expect(collections[0].name).toBe('Restored Collection');

    const requests = await testDb.requests.toArray();
    expect(requests.length).toBe(1);
    expect(requests[0].name).toBe('Restored Req');
  });

  it('exports and imports Postman Collection v2.1 format accurately', async () => {
    // 1. Seed collection with nested folder and request
    await testDb.collections.add({
      id: 'col-pm-export',
      name: 'Postman Interop API',
      description: 'Testing Postman v2.1 export and import',
      auth: { type: 'bearer', bearer: { token: 'token-pm' } },
      variables: [{ id: 'v-1', key: 'base_url', initialValue: 'https://api.pm.io', enabled: true }],
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    await testDb.folders.add({
      id: 'fld-pm',
      collectionId: 'col-pm-export',
      parentId: null,
      name: 'V1 Endpoints',
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    await testDb.requests.add({
      id: 'req-pm-1',
      collectionId: 'col-pm-export',
      folderId: 'fld-pm',
      name: 'Get Users Postman',
      method: 'GET',
      url: '{{base_url}}/users',
      params: [{ id: 'p1', key: 'limit', value: '10', enabled: true }],
      headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      bodyType: 'none',
      createdAt: 1,
      updatedAt: 1,
    });

    // 2. Export to Postman v2.1
    const postmanJson = await exporter.exportPostmanV21('col-pm-export', { includeSecrets: true });
    expect(postmanJson.info.name).toBe('Postman Interop API');
    expect(postmanJson.info.schema).toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
    expect(postmanJson.item.length).toBe(1); // folder
    expect(postmanJson.item[0].name).toBe('V1 Endpoints');
    expect(postmanJson.item[0].item[0].name).toBe('Get Users Postman');

    // 3. Import back through collectionImporter
    const parsed = importer.parseInput(JSON.stringify(postmanJson));
    expect(parsed.format).toBe('postman');
    expect(parsed.collection.name).toBe('Postman Interop API');
    expect(parsed.folders.length).toBe(1);
    expect(parsed.requests.length).toBe(1);
    expect(parsed.requests[0].name).toBe('Get Users Postman');

    const commitResult = await importer.commitImport(parsed);
    expect(commitResult.collectionName).toBe('Postman Interop API');
    expect(commitResult.requestCount).toBe(1);
  });
});
