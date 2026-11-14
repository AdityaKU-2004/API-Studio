import { ApiStudioDatabase } from './database';
import { initialCollections, sampleRequests, initialEnvironments } from '../data/mockData';
import { CollectionDefinition, FolderDefinition, ApiRequest } from '../types';

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

      // Extract children
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

          // Requests inside folder
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

    // Ensure any remaining sample requests are added
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

        // Seed initial environments
        await dbInstance.environments.bulkAdd(initialEnvironments);

        // Seed initial global variables
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

        // Seed initial settings
        await dbInstance.settings.put({
          id: 'app_settings',
          theme: 'dark',
          sidebarWidth: 280,
          splitRatio: 52,
          activeWorkspaceId: 'ws-default',
          activeEnvironmentId: 'env-dev',
          historyRetentionLimit: 50,
          retainResponseBodiesInHistory: true,
          defaultTimeout: 10000,
          updatedAt: Date.now(),
        });
      }
    );
  }
}
