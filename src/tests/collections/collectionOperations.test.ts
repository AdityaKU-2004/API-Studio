import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ApiStudioDatabase } from '../../database/database';
import { CollectionRepository } from '../../repositories/collectionRepository';
import { FolderRepository } from '../../repositories/folderRepository';
import { RequestRepository } from '../../repositories/requestRepository';
import { CollectionDefinition, FolderDefinition, ApiRequest } from '../../types';

describe('Phase 4: Collection & Folder Operations', () => {
  let testDb: ApiStudioDatabase;
  let colRepo: CollectionRepository;
  let fldRepo: FolderRepository;
  let reqRepo: RequestRepository;

  beforeEach(async () => {
    testDb = new ApiStudioDatabase();
    await testDb.open();
    await Promise.all([
      testDb.collections.clear(),
      testDb.folders.clear(),
      testDb.requests.clear(),
    ]);

    colRepo = new CollectionRepository(testDb);
    fldRepo = new FolderRepository(testDb);
    reqRepo = new RequestRepository(testDb);
  });

  it('creates, retrieves, and updates collections', async () => {
    const col: CollectionDefinition = {
      id: 'col-1',
      name: 'Auth Collection',
      description: 'Authentication endpoints',
      color: 'blue',
      icon: 'shield',
      auth: { type: 'bearer', bearer: { token: 'secret-token' } },
      headers: [{ id: 'h-1', key: 'Accept', value: 'application/json', enabled: true }],
      variables: [],
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await colRepo.create(col);
    const retrieved = await colRepo.getById('col-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Auth Collection');
    expect(retrieved?.color).toBe('blue');

    await colRepo.update('col-1', { name: 'Updated Auth Collection', color: 'cyan' });
    const updated = await colRepo.getById('col-1');
    expect(updated?.name).toBe('Updated Auth Collection');
    expect(updated?.color).toBe('cyan');
  });

  it('cascades deletion across folders and requests when collection is deleted', async () => {
    await colRepo.create({
      id: 'col-to-delete',
      name: 'Temp Col',
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await fldRepo.create({
      id: 'fld-in-col',
      collectionId: 'col-to-delete',
      name: 'Temp Folder',
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const sampleReq: ApiRequest = {
      id: 'req-in-col',
      collectionId: 'col-to-delete',
      folderId: 'fld-in-col',
      name: 'Login',
      method: 'POST',
      url: 'https://api.test/login',
      params: [],
      headers: [],
      bodyType: 'json',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await reqRepo.create(sampleReq);

    // Delete collection
    await colRepo.delete('col-to-delete');

    expect(await colRepo.getById('col-to-delete')).toBeUndefined();
    expect(await fldRepo.getById('fld-in-col')).toBeUndefined();
    expect(await reqRepo.getById('req-in-col')).toBeUndefined();
  });

  it('manages multi-level nested folders and prevents circular nesting', async () => {
    const parentFolder: FolderDefinition = {
      id: 'fld-root',
      collectionId: 'col-1',
      parentId: null,
      name: 'Root Folder',
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const childFolder: FolderDefinition = {
      id: 'fld-child',
      collectionId: 'col-1',
      parentId: 'fld-root',
      name: 'Child Folder',
      order: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const grandChildFolder: FolderDefinition = {
      id: 'fld-grandchild',
      collectionId: 'col-1',
      parentId: 'fld-child',
      name: 'Grandchild Folder',
      order: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await fldRepo.create(parentFolder);
    await fldRepo.create(childFolder);
    await fldRepo.create(grandChildFolder);

    // Verify descendants
    const descendants = await fldRepo.getDescendantFolderIds('fld-root');
    expect(descendants).toContain('fld-child');
    expect(descendants).toContain('fld-grandchild');

    // Attempt circular move: moving parent into grandchild must be prevented
    const circularMoveAttempt = await fldRepo.move('fld-root', 'col-1', 'fld-grandchild');
    expect(circularMoveAttempt).toBe(false);

    // Attempt moving folder into itself must be prevented
    const selfMoveAttempt = await fldRepo.move('fld-root', 'col-1', 'fld-root');
    expect(selfMoveAttempt).toBe(false);

    // Valid move: moving grandchild to root
    const validMove = await fldRepo.move('fld-grandchild', 'col-1', null);
    expect(validMove).toBe(true);

    const updatedGrandchild = await fldRepo.getById('fld-grandchild');
    expect(updatedGrandchild?.parentId).toBeNull();
  });

  it('moves requests between collections and folders preserving metadata', async () => {
    const req: ApiRequest = {
      id: 'req-move-test',
      collectionId: 'col-source',
      folderId: 'fld-source',
      name: 'Get User Profile',
      method: 'GET',
      url: 'https://api.test/profile',
      params: [{ id: 'p1', key: 'fields', value: 'all', enabled: true }],
      headers: [],
      bodyType: 'none',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await reqRepo.create(req);

    // Move request to a different collection and root level
    await reqRepo.move('req-move-test', 'col-dest', null);

    const moved = await reqRepo.getById('req-move-test');
    expect(moved?.collectionId).toBe('col-dest');
    expect(moved?.folderId).toBeUndefined();
    expect(moved?.params[0].key).toBe('fields');
  });

  it('reorders collections and requests correctly', async () => {
    await colRepo.create({ id: 'c1', name: 'Col 1', order: 0, createdAt: 1, updatedAt: 1 });
    await colRepo.create({ id: 'c2', name: 'Col 2', order: 1, createdAt: 1, updatedAt: 1 });
    await colRepo.create({ id: 'c3', name: 'Col 3', order: 2, createdAt: 1, updatedAt: 1 });

    await colRepo.reorder(['c3', 'c1', 'c2']);

    const all = await colRepo.getAll();
    expect(all.map((c) => c.id)).toEqual(['c3', 'c1', 'c2']);
  });
});
