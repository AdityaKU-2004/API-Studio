import { db, ApiStudioDatabase } from '../../database/database';
import { CollectionRepository } from '../../repositories/collectionRepository';
import { FolderRepository } from '../../repositories/folderRepository';
import { RequestRepository } from '../../repositories/requestRepository';
import { CollectionDefinition, FolderDefinition, ApiRequest } from '../../types';

export interface ExportOptions {
  includeSecrets?: boolean;
}

export class CollectionExporter {
  private colRepo: CollectionRepository;
  private fldRepo: FolderRepository;
  private reqRepo: RequestRepository;

  constructor(private database: ApiStudioDatabase = db) {
    this.colRepo = new CollectionRepository(database);
    this.fldRepo = new FolderRepository(database);
    this.reqRepo = new RequestRepository(database);
  }

  /**
   * Exports a collection and its nested folders and requests in API Studio JSON format.
   */
  async exportApiStudio(collectionId: string, options: ExportOptions = {}): Promise<any> {
    const col = await this.colRepo.getById(collectionId);
    if (!col) throw new Error('Collection not found');

    const folders = await this.fldRepo.getByCollectionId(collectionId);
    const requests = await this.reqRepo.getByCollectionId(collectionId);

    // Sanitize secrets if requested
    const sanitizedCol: CollectionDefinition = options.includeSecrets
      ? col
      : {
          ...col,
          variables: col.variables?.map((v) =>
            v.isSecret || v.secret ? { ...v, currentValue: '', initialValue: '' } : v
          ),
        };

    const sanitizedRequests: ApiRequest[] = options.includeSecrets
      ? requests
      : requests.map((r) => {
          const reqCopy = JSON.parse(JSON.stringify(r)) as ApiRequest;
          if (reqCopy.auth?.bearer) reqCopy.auth.bearer.token = '';
          if (reqCopy.auth?.basic) reqCopy.auth.basic.password = '';
          if (reqCopy.auth?.apiKey) reqCopy.auth.apiKey.value = '';
          return reqCopy;
        });

    return {
      format: 'api-studio-collection',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      collection: sanitizedCol,
      folders,
      requests: sanitizedRequests,
    };
  }

  /**
   * Exports a collection into Postman Collection v2.1 compatible format.
   */
  async exportPostmanV21(collectionId: string, options: ExportOptions = {}): Promise<any> {
    const col = await this.colRepo.getById(collectionId);
    if (!col) throw new Error('Collection not found');

    const folders = await this.fldRepo.getByCollectionId(collectionId);
    const requests = await this.reqRepo.getByCollectionId(collectionId);

    // Map requests by folder
    const requestsByFolder = new Map<string, ApiRequest[]>();
    const rootRequests: ApiRequest[] = [];

    for (const r of requests) {
      if (r.folderId) {
        const list = requestsByFolder.get(r.folderId) || [];
        list.push(r);
        requestsByFolder.set(r.folderId, list);
      } else {
        rootRequests.push(r);
      }
    }

    // Convert ApiRequest to Postman Item
    const convertRequestToPostmanItem = (req: ApiRequest) => {
      const headers = (req.headers || [])
        .filter((h) => h.enabled && h.key.trim())
        .map((h) => ({
          key: h.key,
          value: h.value,
          description: h.description,
        }));

      // Postman body
      let postmanBody: any = undefined;
      const mode = req.body?.mode || 'none';
      if (mode === 'json') {
        postmanBody = {
          mode: 'raw',
          raw: req.body?.rawContent?.json || req.rawBody || '',
          options: { raw: { language: 'json' } },
        };
      } else if (mode === 'text' || mode === 'xml' || mode === 'html') {
        postmanBody = {
          mode: 'raw',
          raw: req.body?.rawContent?.[mode] || req.rawBody || '',
          options: { raw: { language: mode } },
        };
      } else if (mode === 'x-www-form-urlencoded') {
        postmanBody = {
          mode: 'urlencoded',
          urlencoded: (req.body?.urlEncoded || []).map((u) => ({
            key: u.key,
            value: u.value,
            description: u.description,
          })),
        };
      }

      return {
        name: req.name,
        request: {
          method: req.method,
          header: headers,
          body: postmanBody,
          url: {
            raw: req.url,
            query: (req.params || [])
              .filter((p) => p.enabled && p.key.trim())
              .map((p) => ({
                key: p.key,
                value: p.value,
                description: p.description,
              })),
          },
        },
      };
    };

    // Recursive folder builder
    const buildFolderItems = (parentId: string | null = null): any[] => {
      const matching = folders.filter((f) => (f.parentId || null) === parentId);
      return matching.map((f) => {
        const subFolderItems = buildFolderItems(f.id);
        const folderReqs = (requestsByFolder.get(f.id) || []).map(convertRequestToPostmanItem);

        return {
          name: f.name,
          item: [...subFolderItems, ...folderReqs],
          description: f.description,
        };
      });
    };

    const rootItems = [
      ...buildFolderItems(null),
      ...rootRequests.map(convertRequestToPostmanItem),
    ];

    return {
      info: {
        _postman_id: col.id,
        name: col.name,
        description: col.description || '',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: rootItems,
      variable: (col.variables || []).map((v) => ({
        key: v.key,
        value: options.includeSecrets ? v.currentValue : '',
        description: v.description,
      })),
    };
  }
}

export const collectionExporter = new CollectionExporter();
