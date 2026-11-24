import JSZip from 'jszip';
import {
  ApiVersionEntry,
  DocumentationConfig,
  MockServerConfig,
  OpenApiSpecRecord,
  ProjectArchiveManifest,
  ProjectArchiveValidationResult,
  ProjectImportConflictStrategy,
  ProjectImportPreview,
  ProjectRecord,
} from '../../types';
import { db } from '../../database/database';
import { scrubSensitiveEnvironmentVariables } from '../collaboration/workspaceService';

const MAX_ZIP_ENTRIES = 500;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024; // 25 MB safety limit

export function isUnsafeZipEntryPath(entryPath: string): boolean {
  if (!entryPath) return true;
  if (entryPath.includes('\0')) return true;
  if (entryPath.startsWith('/') || entryPath.startsWith('\\')) return true;
  if (/^[a-zA-Z]:/.test(entryPath)) return true; // Windows drive letters
  const normalized = entryPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (segments.some((seg) => seg === '..')) return true;
  return false;
}

export async function exportProjectZipBlob(options: {
  project: ProjectRecord;
  workspaceName: string;
  includeSecrets?: boolean;
}): Promise<{ blob: Blob; fileName: string; manifest: ProjectArchiveManifest }> {
  const { project, workspaceName, includeSecrets = false } = options;

  const [
    allCollections,
    allFolders,
    allRequests,
    allEnvironments,
    allSpecs,
    allVersions,
    allDocs,
    allMocks,
    allSuites,
  ] = await Promise.all([
    db.collections.toArray(),
    db.folders.toArray(),
    db.requests.toArray(),
    db.environments.toArray(),
    db.apiSpecs.toArray(),
    db.apiVersions.toArray(),
    db.documentationConfigs.toArray(),
    db.mockServers.toArray(),
    db.testSuites.toArray(),
  ]);

  const collections = project.collectionIds.length
    ? allCollections.filter((c) => project.collectionIds.includes(c.id))
    : allCollections;
  const collectionIdSet = new Set(collections.map((c) => c.id));
  const folders = allFolders.filter((f) => collectionIdSet.has(f.collectionId));
  const requests = allRequests.filter((r) => !r.collectionId || collectionIdSet.has(r.collectionId));

  const specs = allSpecs.filter(
    (s) => s.projectId === project.id || project.specIds.includes(s.id)
  );
  const specIdSet = new Set(specs.map((s) => s.id));
  const apiVersions = allVersions.filter((v) => specIdSet.has(v.specId));
  const documentationConfigs = allDocs.filter((d) => specIdSet.has(d.specId));
  const mockServers = allMocks.filter(
    (m) => m.projectId === project.id || project.mockServerIds.includes(m.id)
  );
  const testSuites = allSuites.filter(
    (ts) => !ts.collectionId || collectionIdSet.has(ts.collectionId)
  );

  const scrubbedEnvs = scrubSensitiveEnvironmentVariables(
    allEnvironments as unknown as Array<Record<string, unknown>>,
    includeSecrets
  );

  const manifest: ProjectArchiveManifest = {
    archiveFormat: 'api-studio-project-zip-v1',
    exportedAt: Date.now(),
    appVersion: '2.0.0',
    projectName: project.name,
    workspaceName,
    includesSecrets: includeSecrets,
    counts: {
      collections: collections.length,
      folders: folders.length,
      requests: requests.length,
      environments: scrubbedEnvs.length,
      specs: specs.length,
      apiVersions: apiVersions.length,
      mockServers: mockServers.length,
      testSuites: testSuites.length,
    },
  };

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('project.json', JSON.stringify(project, null, 2));
  zip.file('collections/collections.json', JSON.stringify(collections, null, 2));
  zip.file('collections/folders.json', JSON.stringify(folders, null, 2));
  zip.file('collections/requests.json', JSON.stringify(requests, null, 2));
  zip.file('environments/environments.json', JSON.stringify(scrubbedEnvs, null, 2));
  zip.file('mocks/servers.json', JSON.stringify(mockServers, null, 2));
  zip.file('tests/suites.json', JSON.stringify(testSuites, null, 2));
  zip.file('docs/configs.json', JSON.stringify(documentationConfigs, null, 2));

  for (const spec of specs) {
    const safeSlug = spec.name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
    zip.file(`specs/${safeSlug}.${spec.format}`, spec.content);
    zip.file(`specs/${safeSlug}.meta.json`, JSON.stringify({ ...spec, content: undefined }, null, 2));
  }
  zip.file('specs/versions.json', JSON.stringify(apiVersions, null, 2));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const slug = project.name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-') || 'project';
  const fileName = `${slug}-api-studio-project.zip`;

  return { blob, fileName, manifest };
}

export async function inspectAndValidateProjectZip(
  data: ArrayBuffer | Uint8Array | Blob
): Promise<ProjectImportPreview> {
  const zip = await JSZip.loadAsync(data);
  const errors: string[] = [];
  const warnings: string[] = [];

  const entries = Object.values(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    errors.push(`ZIP archive exceeds maximum entry limit (${MAX_ZIP_ENTRIES}).`);
  }

  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    if (isUnsafeZipEntryPath(entry.name)) {
      errors.push(`Blocked unsafe archive entry path (possible Zip-Slip traversal): "${entry.name}"`);
    }
    if (!entry.dir) {
      const contentBytes = await entry.async('uint8array');
      totalUncompressedBytes += contentBytes.byteLength;
      if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
        errors.push(`ZIP uncompressed payload exceeds 25 MB safety cap.`);
        break;
      }
    }
  }

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    errors.push('Missing required manifest.json in project archive.');
  }

  let manifest: ProjectArchiveManifest = {
    archiveFormat: 'api-studio-project-zip-v1',
    exportedAt: Date.now(),
    appVersion: '2.0.0',
    projectName: 'Imported Project',
    workspaceName: 'Personal Workspace',
    includesSecrets: false,
    counts: {
      collections: 0,
      folders: 0,
      requests: 0,
      environments: 0,
      specs: 0,
      apiVersions: 0,
      mockServers: 0,
      testSuites: 0,
    },
  };

  if (manifestFile) {
    try {
      const parsedManifest = JSON.parse(await manifestFile.async('text')) as ProjectArchiveManifest;
      if (parsedManifest.archiveFormat !== 'api-studio-project-zip-v1') {
        warnings.push(`Unexpected archive format "${parsedManifest.archiveFormat}".`);
      }
      manifest = parsedManifest;
    } catch {
      errors.push('manifest.json contains invalid JSON.');
    }
  }

  const readJsonArray = async <T>(path: string): Promise<T[]> => {
    const file = zip.file(path);
    if (!file) return [];
    try {
      const parsed = JSON.parse(await file.async('text'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      errors.push(`${path} contains invalid JSON.`);
      return [];
    }
  };

  let project: Partial<ProjectRecord> | undefined;
  const projectFile = zip.file('project.json');
  if (projectFile) {
    try {
      project = JSON.parse(await projectFile.async('text'));
    } catch {
      warnings.push('project.json could not be parsed cleanly; a new project record will be created.');
    }
  }

  const collections = await readJsonArray<Record<string, unknown>>('collections/collections.json');
  const folders = await readJsonArray<Record<string, unknown>>('collections/folders.json');
  const requests = await readJsonArray<Record<string, unknown>>('collections/requests.json');
  const environments = await readJsonArray<Record<string, unknown>>('environments/environments.json');
  const mockServers = await readJsonArray<MockServerConfig>('mocks/servers.json');
  const testSuites = await readJsonArray<Record<string, unknown>>('tests/suites.json');
  const documentationConfigs = await readJsonArray<DocumentationConfig>('docs/configs.json');
  const apiVersions = await readJsonArray<ApiVersionEntry>('specs/versions.json');

  // Reconstruct specs from meta + spec text
  const specs: OpenApiSpecRecord[] = [];
  for (const entry of entries) {
    if (!entry.dir && entry.name.startsWith('specs/') && entry.name.endsWith('.meta.json')) {
      try {
        const meta = JSON.parse(await entry.async('text')) as Omit<OpenApiSpecRecord, 'content'>;
        const baseName = entry.name.slice(0, -'.meta.json'.length);
        const contentEntry =
          zip.file(`${baseName}.${meta.format || 'yaml'}`) ||
          zip.file(`${baseName}.yaml`) ||
          zip.file(`${baseName}.json`);
        const content = contentEntry ? await contentEntry.async('text') : '';
        if (content) {
          specs.push({ ...meta, content });
        }
      } catch {
        warnings.push(`Skipped unreadable spec metadata: ${entry.name}`);
      }
    }
  }

  if (!manifest.includesSecrets) {
    warnings.push('Environment secrets were scrubbed at export time; fill in secret values after import.');
  }

  const validation: ProjectArchiveValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest,
    totalEntries: entries.length,
    totalUncompressedBytes,
  };

  return {
    validation,
    manifest,
    payload: {
      project,
      collections,
      folders,
      requests,
      environments,
      specs,
      apiVersions,
      documentationConfigs,
      mockServers,
      testSuites,
    },
  };
}

export async function commitProjectZipImport(
  preview: ProjectImportPreview,
  options: {
    workspaceId: string;
    strategy: ProjectImportConflictStrategy;
  }
): Promise<{ importedProjectId: string; counts: Record<string, number> }> {
  if (!preview.validation.valid) {
    throw new Error(`Cannot import invalid archive: ${preview.validation.errors.join('; ')}`);
  }

  const now = Date.now();
  const suffix = Math.random().toString(36).slice(2, 7);
  const projectId =
    options.strategy === 'merge-new-ids'
      ? `proj-${now}-${suffix}`
      : preview.payload.project?.id || `proj-${now}-${suffix}`;

  const counts: Record<string, number> = {
    collections: 0,
    requests: 0,
    environments: 0,
    specs: 0,
    mockServers: 0,
  };

  const idMap = new Map<string, string>();
  const mapId = (origId: string, prefix: string) => {
    if (options.strategy !== 'merge-new-ids') return origId;
    if (!idMap.has(origId)) {
      idMap.set(origId, `${prefix}-${now}-${idMap.size}-${suffix}`);
    }
    return idMap.get(origId)!;
  };

  const importedCollectionIds: string[] = [];
  for (const col of preview.payload.collections) {
    const origId = String(col.id || '');
    const nextId = mapId(origId, 'col');
    if (options.strategy === 'skip-existing' && (await db.collections.get(nextId))) continue;
    await db.collections.put({ ...(col as any), id: nextId, updatedAt: now });
    importedCollectionIds.push(nextId);
    counts.collections++;
  }

  for (const fld of preview.payload.folders) {
    const origId = String(fld.id || '');
    const nextId = mapId(origId, 'fld');
    const nextColId = mapId(String(fld.collectionId || ''), 'col');
    if (options.strategy === 'skip-existing' && (await db.folders.get(nextId))) continue;
    await db.folders.put({ ...(fld as any), id: nextId, collectionId: nextColId, updatedAt: now });
  }

  for (const req of preview.payload.requests) {
    const origId = String(req.id || '');
    const nextId = mapId(origId, 'req');
    const nextColId = req.collectionId ? mapId(String(req.collectionId), 'col') : undefined;
    const nextFldId = req.folderId ? mapId(String(req.folderId), 'fld') : undefined;
    if (options.strategy === 'skip-existing' && (await db.requests.get(nextId))) continue;
    await db.requests.put({
      ...(req as any),
      id: nextId,
      collectionId: nextColId,
      folderId: nextFldId,
      updatedAt: now,
    });
    counts.requests++;
  }

  for (const env of preview.payload.environments) {
    const origId = String(env.id || '');
    const nextId = mapId(origId, 'env');
    if (options.strategy === 'skip-existing' && (await db.environments.get(nextId))) continue;
    await db.environments.put({ ...(env as any), id: nextId, updatedAt: now });
    counts.environments++;
  }

  const importedSpecIds: string[] = [];
  for (const spec of preview.payload.specs) {
    const nextSpecId = mapId(spec.id, 'spec');
    if (options.strategy === 'skip-existing' && (await db.apiSpecs.get(nextSpecId))) continue;
    await db.apiSpecs.put({
      ...spec,
      id: nextSpecId,
      projectId,
      workspaceId: options.workspaceId,
      updatedAt: now,
    });
    importedSpecIds.push(nextSpecId);
    counts.specs++;
  }

  for (const ver of preview.payload.apiVersions) {
    const nextVerId = mapId(ver.id, 'ver');
    const nextSpecId = mapId(ver.specId, 'spec');
    await db.apiVersions.put({ ...ver, id: nextVerId, specId: nextSpecId, updatedAt: now });
  }

  const importedMockIds: string[] = [];
  for (const mock of preview.payload.mockServers) {
    const nextMockId = mapId(mock.id, 'mock');
    if (options.strategy === 'skip-existing' && (await db.mockServers.get(nextMockId))) continue;
    await db.mockServers.put({
      ...mock,
      id: nextMockId,
      projectId,
      isRunning: false,
      updatedAt: now,
    });
    importedMockIds.push(nextMockId);
    counts.mockServers++;
  }

  await db.projects.put({
    id: projectId,
    workspaceId: options.workspaceId,
    name:
      options.strategy === 'merge-new-ids'
        ? `${preview.manifest.projectName} (Imported)`
        : preview.manifest.projectName,
    description: preview.payload.project?.description || 'Imported from Project ZIP Archive',
    collectionIds: importedCollectionIds,
    specIds: importedSpecIds,
    mockServerIds: importedMockIds,
    isPinned: false,
    lastOpenedAt: now,
    createdAt: preview.payload.project?.createdAt || now,
    updatedAt: now,
  });

  return { importedProjectId: projectId, counts };
}
