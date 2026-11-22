import { ApiStudioDatabase } from './database';
import { initialCollections, sampleRequests, initialEnvironments } from '../data/mockData';
import { CollectionDefinition, FolderDefinition, ApiRequest, SavedJsonSchema } from '../types';
import { BUILT_IN_SCRIPT_TEMPLATES } from '../services/scripting/builtInTemplates';

const SAMPLE_SCHEMAS: SavedJsonSchema[] = [
  {
    id: 'schema-user-profile',
    name: 'User Profile Schema',
    description: 'Validates standard user resource JSON payload with id, name, and email.',
    schemaText: JSON.stringify(
      {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: ['number', 'string'] },
          name: { type: 'string', minLength: 1 },
          email: { type: 'string' },
          username: { type: 'string' },
        },
        additionalProperties: true,
      },
      null,
      2
    ),
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
  },
  {
    id: 'schema-post-list',
    name: 'Resource Collection Array',
    description: 'Validates an array of resource items with numeric IDs and titles.',
    schemaText: JSON.stringify(
      {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
          },
        },
      },
      null,
      2
    ),
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
  },
];

export async function runMigrationsAndSeed(dbInstance: ApiStudioDatabase): Promise<void> {
  const collectionCount = await dbInstance.collections.count();

  // If empty, seed initial collections, folders, and requests from mockData
  if (collectionCount === 0) {
    const collectionsToInsert: CollectionDefinition[] = [];
    const foldersToInsert: FolderDefinition[] = [];
    const requestsToInsert: ApiRequest[] = [];

    let colOrder = 0;
    for (const mockCol of initialCollections) {
      colOrder++;
      collectionsToInsert.push({
        id: mockCol.id,
        name: mockCol.name,
        description: mockCol.description || 'Collection of endpoints',
        color: mockCol.color || 'cyan',
        icon: mockCol.icon || 'folder',
        order: colOrder,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      let itemOrder = 0;
      for (const child of mockCol.children || []) {
        itemOrder++;
        if (child.type === 'folder') {
          foldersToInsert.push({
            id: child.id,
            collectionId: mockCol.id,
            parentId: null,
            name: child.name,
            order: itemOrder,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          let subOrder = 0;
          for (const grandChild of child.children || []) {
            subOrder++;
            if (grandChild.request) {
              requestsToInsert.push({
                ...grandChild.request,
                collectionId: mockCol.id,
                folderId: child.id,
                order: subOrder,
              });
            }
          }
        } else if (child.type === 'request' && child.request) {
          requestsToInsert.push({
            ...child.request,
            collectionId: mockCol.id,
            folderId: undefined,
            order: itemOrder,
          });
        }
      }
    }

    for (const [id, req] of Object.entries(sampleRequests)) {
      if (!requestsToInsert.some((r) => r.id === id)) {
        requestsToInsert.push({
          ...req,
          collectionId: req.collectionId || 'col-users',
        });
      }
    }

    await dbInstance.transaction(
      'rw',
      [
        dbInstance.collections,
        dbInstance.folders,
        dbInstance.requests,
        dbInstance.environments,
        dbInstance.globalVariables,
        dbInstance.settings,
      ],
      async () => {
        await dbInstance.collections.bulkAdd(collectionsToInsert);
        await dbInstance.folders.bulkAdd(foldersToInsert);
        await dbInstance.requests.bulkAdd(requestsToInsert);
        await dbInstance.environments.bulkAdd(initialEnvironments);

        await dbInstance.globalVariables.bulkAdd([
          {
            id: 'gvar-1',
            key: 'app_name',
            initialValue: 'API Studio',
            currentValue: 'API Studio',
            description: 'Global application name identifier',
            enabled: true,
            isSecret: false,
            scope: 'global',
          },
          {
            id: 'gvar-2',
            key: 'company_domain',
            initialValue: 'example.com',
            currentValue: 'example.com',
            description: 'Global company domain',
            enabled: true,
            isSecret: false,
            scope: 'global',
          },
        ]);

        await dbInstance.settings.put({
          id: 'app_settings',
          theme: 'dark',
          sidebarWidth: 280,
          splitRatio: 52,
          activeWorkspaceId: 'ws-default',
          activeEnvironmentId: 'env-dev',
          historyRetentionLimit: 50,
          retainResponseBodiesInHistory: true,
          reportRetentionLimit: 50,
          defaultTimeout: 10000,
          updatedAt: Date.now(),
        });
      }
    );
  }

  // Non-destructive v2 seed: ensure built-in script templates & sample schemas exist
  try {
    const templateCount = await dbInstance.scriptTemplates.count();
    if (templateCount === 0) {
      await dbInstance.scriptTemplates.bulkPut(BUILT_IN_SCRIPT_TEMPLATES);
    }

    const schemaCount = await dbInstance.jsonSchemas.count();
    if (schemaCount === 0) {
      await dbInstance.jsonSchemas.bulkPut(SAMPLE_SCHEMAS);
    }

    // Non-destructive v3 seed: WebSocket templates & developer tool preferences
    const wsTemplateCount = await dbInstance.wsMessageTemplates.count();
    if (wsTemplateCount === 0) {
      await dbInstance.wsMessageTemplates.bulkPut([
        {
          id: 'ws-tpl-ping',
          name: 'JSON Heartbeat Ping',
          format: 'json',
          payload: JSON.stringify({ type: 'ping', timestamp: '{{$timestamp}}' }, null, 2),
          description: 'Application-level JSON ping payload',
          createdAt: 1710000000000,
          updatedAt: 1710000000000,
        },
        {
          id: 'ws-tpl-subscribe',
          name: 'Subscribe Channel',
          format: 'json',
          payload: JSON.stringify({ action: 'subscribe', channel: 'ticker', symbol: 'BTC-USD' }, null, 2),
          description: 'Channel subscription message template',
          createdAt: 1710000000000,
          updatedAt: 1710000000000,
        },
      ]);
    }

    const devPrefsCount = await dbInstance.developerToolPreferences.count();
    if (devPrefsCount === 0) {
      await dbInstance.developerToolPreferences.put({
        id: 'default_dev_prefs',
        lastActiveTool: 'json-formatter',
        jsonIndentSpaces: 2,
        tsRootInterfaceName: 'Root',
        uuidDefaultCount: 5,
        favoriteTools: ['json-formatter', 'jwt-decoder', 'json-to-ts'],
        updatedAt: Date.now(),
      });
    }
  } catch {
    // ignore if called on an old mock instance
  }
}
