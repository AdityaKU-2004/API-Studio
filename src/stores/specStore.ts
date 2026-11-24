import { create } from 'zustand';
import {
  ApiVersionEntry,
  OpenApiParsedDoc,
  OpenApiSpecFormat,
  OpenApiSpecRecord,
  OpenApiValidationIssue,
  SpecDiffResult,
} from '../types';
import { db } from '../database/database';
import {
  detectSpecFormat,
  parseOpenApiDocument,
  parseRawSpecObject,
  serializeSpecObject,
} from '../services/openapi/openapiParser';
import { validateOpenApiSpec } from '../services/openapi/openapiValidator';
import { compareApiSpecVersions } from '../services/openapi/specDiffEngine';
import { useWorkspaceStore } from './workspaceStore';

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface SpecState {
  specs: OpenApiSpecRecord[];
  versions: ApiVersionEntry[];
  activeSpecId: string | null;
  parsedDoc: OpenApiParsedDoc | null;
  validationIssues: OpenApiValidationIssue[];
  lastDiff: SpecDiffResult | null;
  isLoaded: boolean;

  loadSpecs: () => Promise<void>;
  selectSpec: (specId: string) => void;
  importSpec: (input: {
    rawContent: string;
    name?: string;
    sourceType: OpenApiSpecRecord['sourceType'];
    sourceLocation?: string;
  }) => Promise<OpenApiSpecRecord>;
  updateSpecContent: (specId: string, nextContent: string, nextFormat?: OpenApiSpecFormat) => Promise<void>;
  convertSpecFormat: (specId: string, targetFormat: OpenApiSpecFormat) => Promise<void>;
  deleteSpec: (specId: string) => Promise<void>;
  createVersionSnapshot: (specId: string, versionLabel: string, description?: string) => Promise<ApiVersionEntry>;
  duplicateVersion: (versionId: string, nextLabel: string) => Promise<ApiVersionEntry | null>;
  renameVersion: (versionId: string, nextLabel: string) => Promise<void>;
  setActiveVersion: (specId: string, versionId: string) => Promise<void>;
  toggleArchiveVersion: (versionId: string) => Promise<void>;
  compareVersions: (baseVersionId: string, targetVersionId: string) => SpecDiffResult | null;
}

function evaluateSpec(content: string): {
  parsedDoc: OpenApiParsedDoc | null;
  validationIssues: OpenApiValidationIssue[];
} {
  const validationIssues = validateOpenApiSpec(content);
  try {
    const parsedDoc = parseOpenApiDocument(content);
    return { parsedDoc, validationIssues };
  } catch {
    return { parsedDoc: null, validationIssues };
  }
}

export const useSpecStore = create<SpecState>((set, get) => ({
  specs: [],
  versions: [],
  activeSpecId: null,
  parsedDoc: null,
  validationIssues: [],
  lastDiff: null,
  isLoaded: false,

  loadSpecs: async () => {
    const [specs, versions] = await Promise.all([
      db.apiSpecs.orderBy('updatedAt').reverse().toArray(),
      db.apiVersions.orderBy('createdAt').reverse().toArray(),
    ]);
    const activeSpecId = get().activeSpecId || specs[0]?.id || null;
    const activeSpec = specs.find((s) => s.id === activeSpecId);
    const evalRes = activeSpec ? evaluateSpec(activeSpec.content) : { parsedDoc: null, validationIssues: [] };

    set({
      specs,
      versions,
      activeSpecId,
      parsedDoc: evalRes.parsedDoc,
      validationIssues: evalRes.validationIssues,
      isLoaded: true,
    });
  },

  selectSpec: (specId) => {
    const spec = get().specs.find((s) => s.id === specId);
    if (!spec) return;
    const evalRes = evaluateSpec(spec.content);
    set({
      activeSpecId: specId,
      parsedDoc: evalRes.parsedDoc,
      validationIssues: evalRes.validationIssues,
    });
  },

  importSpec: async ({ rawContent, name, sourceType, sourceLocation }) => {
    const now = Date.now();
    const format = detectSpecFormat(rawContent);
    const evalRes = evaluateSpec(rawContent);

    const parsedTitle = evalRes.parsedDoc?.title || name || 'Imported API Specification';
    const parsedVersion = evalRes.parsedDoc?.version || '1.0.0';
    const wsState = useWorkspaceStore.getState();

    const specId = makeId('spec');
    const verId = makeId('ver');

    const record: OpenApiSpecRecord = {
      id: specId,
      projectId: wsState.activeProjectId,
      workspaceId: wsState.activeWorkspaceId,
      name: name?.trim() || parsedTitle,
      description: evalRes.parsedDoc?.description,
      version: parsedVersion,
      format,
      sourceType,
      sourceLocation,
      content: rawContent,
      activeVersionId: verId,
      validationSummary: {
        errors: evalRes.validationIssues.filter((i) => i.severity === 'error').length,
        warnings: evalRes.validationIssues.filter((i) => i.severity === 'warning').length,
        infos: evalRes.validationIssues.filter((i) => i.severity === 'info').length,
      },
      createdAt: now,
      updatedAt: now,
    };

    const versionEntry: ApiVersionEntry = {
      id: verId,
      specId,
      versionLabel: parsedVersion,
      description: `Imported (${sourceType})`,
      content: rawContent,
      format,
      isActive: true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.apiSpecs.put(record);
    await db.apiVersions.put(versionEntry);

    set((s) => ({
      specs: [record, ...s.specs],
      versions: [versionEntry, ...s.versions],
      activeSpecId: specId,
      parsedDoc: evalRes.parsedDoc,
      validationIssues: evalRes.validationIssues,
    }));

    void wsState.recordActivity({
      action: 'imported OpenAPI spec',
      resourceType: 'spec',
      resourceName: record.name,
    });

    return record;
  },

  updateSpecContent: async (specId, nextContent, nextFormat) => {
    const spec = get().specs.find((s) => s.id === specId);
    if (!spec) return;
    const format = nextFormat || detectSpecFormat(nextContent);
    const evalRes = evaluateSpec(nextContent);

    const updated: OpenApiSpecRecord = {
      ...spec,
      content: nextContent,
      format,
      name: evalRes.parsedDoc?.title || spec.name,
      version: evalRes.parsedDoc?.version || spec.version,
      validationSummary: {
        errors: evalRes.validationIssues.filter((i) => i.severity === 'error').length,
        warnings: evalRes.validationIssues.filter((i) => i.severity === 'warning').length,
        infos: evalRes.validationIssues.filter((i) => i.severity === 'info').length,
      },
      updatedAt: Date.now(),
    };

    await db.apiSpecs.put(updated);

    // Sync active version content if activeVersionId exists
    if (spec.activeVersionId) {
      const ver = get().versions.find((v) => v.id === spec.activeVersionId);
      if (ver) {
        const nextVer: ApiVersionEntry = {
          ...ver,
          content: nextContent,
          format,
          updatedAt: Date.now(),
        };
        await db.apiVersions.put(nextVer);
        set((s) => ({
          versions: s.versions.map((v) => (v.id === ver.id ? nextVer : v)),
        }));
      }
    }

    set((s) => ({
      specs: s.specs.map((item) => (item.id === specId ? updated : item)),
      ...(s.activeSpecId === specId
        ? {
            parsedDoc: evalRes.parsedDoc,
            validationIssues: evalRes.validationIssues,
          }
        : {}),
    }));
  },

  convertSpecFormat: async (specId, targetFormat) => {
    const spec = get().specs.find((s) => s.id === specId);
    if (!spec) return;
    const { doc } = parseRawSpecObject(spec.content);
    const converted = serializeSpecObject(doc, targetFormat);
    await get().updateSpecContent(specId, converted, targetFormat);
  },

  deleteSpec: async (specId) => {
    await db.apiSpecs.delete(specId);
    const relatedVersions = get().versions.filter((v) => v.specId === specId);
    for (const v of relatedVersions) {
      await db.apiVersions.delete(v.id);
    }
    set((s) => {
      const remaining = s.specs.filter((sp) => sp.id !== specId);
      const nextActive = s.activeSpecId === specId ? remaining[0]?.id || null : s.activeSpecId;
      const activeSpec = remaining.find((sp) => sp.id === nextActive);
      const evalRes = activeSpec
        ? evaluateSpec(activeSpec.content)
        : { parsedDoc: null, validationIssues: [] };

      return {
        specs: remaining,
        versions: s.versions.filter((v) => v.specId !== specId),
        activeSpecId: nextActive,
        parsedDoc: evalRes.parsedDoc,
        validationIssues: evalRes.validationIssues,
      };
    });
  },

  createVersionSnapshot: async (specId, versionLabel, description) => {
    const spec = get().specs.find((s) => s.id === specId);
    if (!spec) throw new Error('Specification not found.');
    const now = Date.now();
    const ver: ApiVersionEntry = {
      id: makeId('ver'),
      specId,
      versionLabel: versionLabel.trim() || '1.0.0',
      description: description?.trim(),
      content: spec.content,
      format: spec.format,
      isActive: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.apiVersions.put(ver);
    set((s) => ({ versions: [ver, ...s.versions] }));
    return ver;
  },

  duplicateVersion: async (versionId, nextLabel) => {
    const existing = get().versions.find((v) => v.id === versionId);
    if (!existing) return null;
    const now = Date.now();
    const dup: ApiVersionEntry = {
      ...existing,
      id: makeId('ver'),
      versionLabel: nextLabel.trim() || `${existing.versionLabel}-copy`,
      isActive: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.apiVersions.put(dup);
    set((s) => ({ versions: [dup, ...s.versions] }));
    return dup;
  },

  renameVersion: async (versionId, nextLabel) => {
    const existing = get().versions.find((v) => v.id === versionId);
    if (!existing) return;
    const updated: ApiVersionEntry = {
      ...existing,
      versionLabel: nextLabel.trim() || existing.versionLabel,
      updatedAt: Date.now(),
    };
    await db.apiVersions.put(updated);
    set((s) => ({
      versions: s.versions.map((v) => (v.id === versionId ? updated : v)),
    }));
  },

  setActiveVersion: async (specId, versionId) => {
    const targetVer = get().versions.find((v) => v.id === versionId && v.specId === specId);
    const spec = get().specs.find((s) => s.id === specId);
    if (!targetVer || !spec) return;

    const now = Date.now();
    const updatedVersions = get().versions.map((v) =>
      v.specId === specId ? { ...v, isActive: v.id === versionId, updatedAt: now } : v
    );
    for (const v of updatedVersions.filter((item) => item.specId === specId)) {
      await db.apiVersions.put(v);
    }

    const evalRes = evaluateSpec(targetVer.content);
    const updatedSpec: OpenApiSpecRecord = {
      ...spec,
      version: targetVer.versionLabel,
      content: targetVer.content,
      format: targetVer.format,
      activeVersionId: targetVer.id,
      updatedAt: now,
    };
    await db.apiSpecs.put(updatedSpec);

    set((s) => ({
      versions: updatedVersions,
      specs: s.specs.map((sp) => (sp.id === specId ? updatedSpec : sp)),
      ...(s.activeSpecId === specId
        ? {
            parsedDoc: evalRes.parsedDoc,
            validationIssues: evalRes.validationIssues,
          }
        : {}),
    }));
  },

  toggleArchiveVersion: async (versionId) => {
    const existing = get().versions.find((v) => v.id === versionId);
    if (!existing) return;
    const updated: ApiVersionEntry = {
      ...existing,
      isArchived: !existing.isArchived,
      updatedAt: Date.now(),
    };
    await db.apiVersions.put(updated);
    set((s) => ({
      versions: s.versions.map((v) => (v.id === versionId ? updated : v)),
    }));
  },

  compareVersions: (baseVersionId, targetVersionId) => {
    const baseVer = get().versions.find((v) => v.id === baseVersionId);
    const targetVer = get().versions.find((v) => v.id === targetVersionId);
    if (!baseVer || !targetVer) return null;
    const diff = compareApiSpecVersions(baseVer, targetVer);
    set({ lastDiff: diff });
    return diff;
  },
}));
