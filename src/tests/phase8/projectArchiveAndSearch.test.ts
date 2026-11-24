import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { db } from '../../database/database';
import {
  commitProjectZipImport,
  exportProjectZipBlob,
  inspectAndValidateProjectZip,
  isUnsafeZipEntryPath,
} from '../../services/import-export/projectArchiveService';
import { ProjectRecord } from '../../types';

describe('Phase 8: Project ZIP Export, Zip-Slip Security & Import Validation', () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all([
      db.projects.clear(),
      db.collections.clear(),
      db.folders.clear(),
      db.requests.clear(),
      db.environments.clear(),
      db.apiSpecs.clear(),
      db.apiVersions.clear(),
      db.mockServers.clear(),
    ]);
  });

  it('detects and blocks Zip-Slip traversal and unsafe entry paths', async () => {
    expect(isUnsafeZipEntryPath('../evil.json')).toBe(true);
    expect(isUnsafeZipEntryPath('specs/../../etc/passwd')).toBe(true);
    expect(isUnsafeZipEntryPath('/etc/shadow')).toBe(true);
    expect(isUnsafeZipEntryPath('C:\\Windows\\System32\\cmd.exe')).toBe(true);
    expect(isUnsafeZipEntryPath('specs/orders.yaml')).toBe(false);

    const maliciousZip = new JSZip();
    maliciousZip.file('manifest.json', JSON.stringify({ archiveFormat: 'api-studio-project-zip-v1' }));
    maliciousZip.file('../../escaped-payload.txt', 'pwnd');
    const rawZip = await maliciousZip.generateAsync({ type: 'uint8array' });

    const preview = await inspectAndValidateProjectZip(rawZip);
    expect(preview.validation.valid).toBe(false);
    expect(preview.validation.errors.some((e) => e.includes('Zip-Slip'))).toBe(true);
  });

  it('exports a complete project ZIP with scrubbed secrets and cleanly imports via merge strategy', async () => {
    const project: ProjectRecord = {
      id: 'proj-export-1',
      workspaceId: 'ws-default',
      name: 'Core Commerce',
      description: 'Commerce APIs',
      collectionIds: ['col-1'],
      specIds: ['spec-1'],
      mockServerIds: ['mock-1'],
      isPinned: true,
      lastOpenedAt: 1000,
      createdAt: 1000,
      updatedAt: 1000,
    };

    await db.projects.put(project);
    await db.collections.put({
      id: 'col-1',
      name: 'Commerce Endpoints',
      order: 1,
      createdAt: 1000,
      updatedAt: 1000,
    });
    await db.environments.put({
      id: 'env-1',
      name: 'Production',
      variables: [
        { id: 'v1', key: 'API_BASE', initialValue: 'https://commerce.test', currentValue: 'https://commerce.test', description: '', enabled: true },
        { id: 'v2', key: 'STRIPE_SECRET_KEY', initialValue: 'sk_live_secret', currentValue: 'sk_live_secret', description: '', isSecret: true, enabled: true },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    });
    await db.apiSpecs.put({
      id: 'spec-1',
      projectId: project.id,
      workspaceId: project.workspaceId,
      name: 'Commerce OpenAPI',
      version: '1.0.0',
      format: 'yaml',
      sourceType: 'manual',
      content: 'openapi: 3.0.3\ninfo:\n  title: Commerce\n  version: 1.0.0\npaths: {}\n',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const exported = await exportProjectZipBlob({
      project,
      workspaceName: 'Engineering',
      includeSecrets: false,
    });
    expect(exported.manifest.includesSecrets).toBe(false);
    expect(exported.manifest.counts.collections).toBe(1);
    expect(exported.manifest.counts.specs).toBe(1);

    const preview = await inspectAndValidateProjectZip(exported.blob);
    expect(preview.validation.valid).toBe(true);
    expect(preview.payload.specs).toHaveLength(1);

    const envVars = (preview.payload.environments[0].variables as Array<Record<string, unknown>>) || [];
    const secretVar = envVars.find((v) => v.key === 'STRIPE_SECRET_KEY');
    expect(secretVar?.currentValue).toBe('');
    expect(secretVar?.scrubbed).toBe(true);

    // Non-destructive merge import creates new IDs while keeping originals intact
    const committed = await commitProjectZipImport(preview, {
      workspaceId: 'ws-default',
      strategy: 'merge-new-ids',
    });
    expect(committed.counts.collections).toBe(1);
    expect(committed.counts.specs).toBe(1);
    expect(await db.projects.count()).toBe(2);
    expect(await db.collections.count()).toBe(2);
  });
});
