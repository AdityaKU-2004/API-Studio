import { db, ApiStudioDatabase } from '../../database/database';
import { CollectionRepository } from '../../repositories/collectionRepository';
import { FolderRepository } from '../../repositories/folderRepository';
import { RequestRepository } from '../../repositories/requestRepository';
import { CollectionDefinition, FolderDefinition, ApiRequest, HttpMethod } from '../../types';
import { createDefaultRequest } from '../../stores/requestStore';

export interface ImportPreviewResult {
  format: 'api-studio' | 'postman' | 'postman-v2.1';
  collectionName: string;
  description?: string;
  collection: CollectionDefinition;
  folders: FolderDefinition[];
  requests: ApiRequest[];
  errors: string[];
  folderCount: number;
  requestCount: number;
  variableCount: number;
  parsedBundle: {
    collection: CollectionDefinition;
    folders: FolderDefinition[];
    requests: ApiRequest[];
  };
}

export type ParsedImportResult = ImportPreviewResult;

export class CollectionImporter {
  private colRepo: CollectionRepository;
  private fldRepo: FolderRepository;
  private reqRepo: RequestRepository;

  constructor(private database: ApiStudioDatabase = db) {
    this.colRepo = new CollectionRepository(database);
    this.fldRepo = new FolderRepository(database);
    this.reqRepo = new RequestRepository(database);
  }

  /**
   * Inspects and parses input JSON string into a previewable import bundle.
   */
  parseInput(jsonString: string): ImportPreviewResult {
    let json: any;
    try {
      json = JSON.parse(jsonString);
    } catch {
      return {
        format: 'api-studio',
        collectionName: 'Invalid JSON',
        collection: { id: '', name: 'Invalid', createdAt: 0, updatedAt: 0 } as any,
        folders: [],
        requests: [],
        errors: ['Input is not valid JSON text.'],
        folderCount: 0,
        requestCount: 0,
        variableCount: 0,
        parsedBundle: {
          collection: { id: '', name: 'Invalid', createdAt: 0, updatedAt: 0 } as any,
          folders: [],
          requests: [],
        },
      };
    }

    if (json.format === 'api-studio-collection' && json.collection && Array.isArray(json.requests)) {
      return this.parseApiStudioFormat(json);
    }

    if (json.info && Array.isArray(json.item)) {
      return this.parsePostmanFormat(json);
    }

    return {
      format: 'api-studio',
      collectionName: 'Unknown Format',
      collection: { id: '', name: 'Unknown', createdAt: 0, updatedAt: 0 } as any,
      folders: [],
      requests: [],
      errors: ['Unrecognized collection format. Supported formats: API Studio JSON or Postman Collection v2.1.'],
      folderCount: 0,
      requestCount: 0,
      variableCount: 0,
      parsedBundle: {
        collection: { id: '', name: 'Unknown', createdAt: 0, updatedAt: 0 } as any,
        folders: [],
        requests: [],
      },
    };
  }

  private parseApiStudioFormat(json: any): ImportPreviewResult {
    const rawCol = json.collection;
    const now = Date.now();
    const newColId = 'col-' + now + Math.random().toString(36).substring(2, 6);

    const collection: CollectionDefinition = {
      ...rawCol,
      id: newColId,
      name: rawCol.name ? `${rawCol.name}` : 'Imported Collection',
      createdAt: now,
      updatedAt: now,
    };

    // Remap folder IDs to prevent collisions
    const folderIdMap = new Map<string, string>();
    const folders: FolderDefinition[] = (json.folders || []).map((f: any) => {
      const newFolderId = 'fld-' + now + Math.random().toString(36).substring(2, 6);
      folderIdMap.set(f.id, newFolderId);
      return {
        ...f,
        id: newFolderId,
        collectionId: newColId,
        createdAt: now,
        updatedAt: now,
      };
    });

    // Fix parentId references for nested folders
    for (const f of folders) {
      if (f.parentId && folderIdMap.has(f.parentId)) {
        f.parentId = folderIdMap.get(f.parentId)!;
      } else {
        f.parentId = null;
      }
    }

    const requests: ApiRequest[] = (json.requests || []).map((r: any) => {
      const newReqId = 'req-' + now + Math.random().toString(36).substring(2, 6);
      const targetFolderId = r.folderId && folderIdMap.has(r.folderId) ? folderIdMap.get(r.folderId) : undefined;
      return {
        ...r,
        id: newReqId,
        collectionId: newColId,
        folderId: targetFolderId,
        createdAt: now,
        updatedAt: now,
      };
    });

    return {
      format: 'api-studio',
      collectionName: collection.name,
      description: collection.description,
      collection,
      folders,
      requests,
      errors: [],
      folderCount: folders.length,
      requestCount: requests.length,
      variableCount: collection.variables?.length || 0,
      parsedBundle: {
        collection,
        folders,
        requests,
      },
    };
  }

  private parsePostmanFormat(json: any): ImportPreviewResult {
    const now = Date.now();
    const newColId = 'col-' + now + Math.random().toString(36).substring(2, 6);
    const colName = json.info?.name || 'Imported Postman Collection';
    const colDescription =
      typeof json.info?.description === 'string'
        ? json.info.description
        : json.info?.description?.content || '';

    // Variables
    const variables = (json.variable || []).map((v: any) => ({
      id: 'var-' + Math.random().toString(36).substring(2, 7),
      key: v.key || '',
      initialValue: v.value || '',
      currentValue: v.value || '',
      description: typeof v.description === 'string' ? v.description : '',
      enabled: true,
      scope: 'collection' as const,
    }));

    const collection: CollectionDefinition = {
      id: newColId,
      name: colName,
      description: colDescription,
      color: 'cyan',
      icon: 'folder',
      auth: { type: 'none' },
      headers: [],
      variables,
      order: 1,
      createdAt: now,
      updatedAt: now,
    };

    const folders: FolderDefinition[] = [];
    const requests: ApiRequest[] = [];
    let orderCounter = 0;

    const traverseItems = (items: any[], parentFolderId: string | null = null) => {
      for (const item of items) {
        orderCounter++;
        const isFolder = Array.isArray(item.item) && !item.request;

        if (isFolder) {
          const folderId = 'fld-' + now + Math.random().toString(36).substring(2, 6);
          folders.push({
            id: folderId,
            collectionId: newColId,
            parentId: parentFolderId,
            name: item.name || 'New Folder',
            description: typeof item.description === 'string' ? item.description : item.description?.content || '',
            auth: { type: 'inherit' },
            headers: [],
            variables: [],
            order: orderCounter,
            createdAt: now,
            updatedAt: now,
          });

          traverseItems(item.item, folderId);
        } else if (item.request) {
          const req = item.request;
          const reqId = 'req-' + now + Math.random().toString(36).substring(2, 6);
          const method: HttpMethod = (req.method || 'GET').toUpperCase() as HttpMethod;

          let url = '';
          if (typeof req.url === 'string') {
            url = req.url;
          } else if (req.url?.raw) {
            url = req.url.raw;
          }

          // Headers
          const headers = (req.header || []).map((h: any) => ({
            id: 'h-' + Math.random().toString(36).substring(2, 7),
            key: h.key || '',
            value: h.value || '',
            description: h.description || '',
            enabled: !h.disabled,
          }));

          // Query Params
          const queryParams = (req.url?.query || []).map((q: any) => ({
            id: 'p-' + Math.random().toString(36).substring(2, 7),
            key: q.key || '',
            value: q.value || '',
            description: q.description || '',
            enabled: !q.disabled,
          }));

          // Body
          const defaultReq = createDefaultRequest();
          const body = { ...defaultReq.body };
          let rawBody = '';
          let bodyType: any = 'none';

          if (req.body) {
            if (req.body.mode === 'raw') {
              const lang = req.body.options?.raw?.language;
              bodyType = lang === 'json' ? 'json' : lang === 'xml' ? 'xml' : 'text';
              rawBody = req.body.raw || '';
              body.mode = bodyType;
              body.rawContent = {
                ...body.rawContent,
                [bodyType]: rawBody,
              };
            } else if (req.body.mode === 'urlencoded') {
              bodyType = 'x-www-form-urlencoded';
              body.mode = 'x-www-form-urlencoded';
              body.urlEncoded = (req.body.urlencoded || []).map((u: any) => ({
                id: 'ue-' + Math.random().toString(36).substring(2, 7),
                key: u.key || '',
                value: u.value || '',
                description: u.description || '',
                enabled: !u.disabled,
              }));
            }
          }

          requests.push({
            ...defaultReq,
            id: reqId,
            name: item.name || 'Untitled Request',
            method,
            url,
            bodyType,
            rawBody,
            headers,
            params: queryParams,
            body,
            collectionId: newColId,
            folderId: parentFolderId || undefined,
            order: orderCounter,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    };

    traverseItems(json.item);

    return {
      format: 'postman',
      collectionName: colName,
      description: colDescription,
      collection,
      folders,
      requests,
      errors: [],
      folderCount: folders.length,
      requestCount: requests.length,
      variableCount: collection.variables?.length || 0,
      parsedBundle: {
        collection,
        folders,
        requests,
      },
    };
  }

  /**
   * Commits an import preview bundle directly into IndexedDB.
   */
  async commitImport(preview: ImportPreviewResult): Promise<{
    collectionId: string;
    collectionName: string;
    folderCount: number;
    requestCount: number;
  }> {
    const { collection, folders, requests } = preview.parsedBundle || preview;

    await this.colRepo.create(collection);
    for (const f of folders) {
      await this.fldRepo.create(f);
    }
    for (const r of requests) {
      await this.reqRepo.create(r);
    }

    return {
      collectionId: collection.id,
      collectionName: collection.name,
      folderCount: folders.length,
      requestCount: requests.length,
    };
  }
}

export const collectionImporter = new CollectionImporter();
