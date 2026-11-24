import { ApiStudioDatabase } from './database';
import { initialCollections, sampleRequests, initialEnvironments } from '../data/mockData';
import { CollectionDefinition, FolderDefinition, ApiRequest, SavedJsonSchema } from '../types';
import { BUILT_IN_SCRIPT_TEMPLATES } from '../services/scripting/builtInTemplates';

const SAMPLE_OPENAPI_SPEC = `openapi: 3.0.3
info:
  title: API Studio Sample User Service
  version: 1.0.0
  description: Starter OpenAPI 3.0 specification for exploring endpoints, documentation, mocking, and contract tests.
servers:
  - url: https://jsonplaceholder.typicode.com
    description: Public JSONPlaceholder Demo API
  - url: http://127.0.0.1:4010
    description: Local Mock Server
tags:
  - name: Users
    description: User directory operations
  - name: Posts
    description: Blog post resources
paths:
  /users:
    get:
      tags:
        - Users
      summary: List users
      operationId: listUsers
      parameters:
        - name: _limit
          in: query
          required: false
          schema:
            type: integer
            example: 5
      responses:
        '200':
          description: Array of user profiles
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
  /users/{id}:
    get:
      tags:
        - Users
      summary: Get user by ID
      operationId: getUserById
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
            example: 1
      responses:
        '200':
          description: User profile details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
  /posts:
    post:
      tags:
        - Posts
      summary: Create a new post
      operationId: createPost
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreatePostInput'
      responses:
        '201':
          description: Created post
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Post'
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    User:
      type: object
      required:
        - id
        - name
        - email
      properties:
        id:
          type: integer
          example: 1
        name:
          type: string
          example: Leanne Graham
        username:
          type: string
          example: Bret
        email:
          type: string
          example: Sincere@april.biz
    CreatePostInput:
      type: object
      required:
        - title
        - body
        - userId
      properties:
        title:
          type: string
          example: Hello API Studio
        body:
          type: string
          example: Contract testing payload
        userId:
          type: integer
          example: 1
    Post:
      type: object
      required:
        - id
        - title
        - userId
      properties:
        id:
          type: integer
          example: 101
        title:
          type: string
        body:
          type: string
        userId:
          type: integer
`;

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
          payload: JSON.stringify(
            { action: 'subscribe', channel: 'ticker', symbol: 'BTC-USD' },
            null,
            2
          ),
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

    // Non-destructive v4 seed: Workspaces, Projects, Starter OpenAPI Spec & Version, Starter Mock Server
    const workspaceCount = await dbInstance.workspaces.count();
    if (workspaceCount === 0) {
      const now = Date.now();
      await dbInstance.workspaces.bulkPut([
        {
          id: 'ws-default',
          name: 'Personal Workspace',
          description: 'Private local workspace for designing, testing, and mocking APIs.',
          type: 'personal',
          ownerName: 'Local Developer',
          isPinned: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ws-team-demo',
          name: 'Core Platform Team',
          description: 'Local team workspace model with role permissions and comments.',
          type: 'team',
          ownerName: 'Platform Architect',
          isPinned: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await dbInstance.workspaceMembers.bulkPut([
        {
          id: 'mem-owner',
          workspaceId: 'ws-default',
          name: 'Local Developer',
          email: 'developer@local.studio',
          role: 'Owner',
          status: 'active',
          joinedAt: now,
        },
        {
          id: 'mem-team-owner',
          workspaceId: 'ws-team-demo',
          name: 'Platform Architect',
          email: 'architect@example.com',
          role: 'Owner',
          status: 'active',
          joinedAt: now,
        },
        {
          id: 'mem-team-editor',
          workspaceId: 'ws-team-demo',
          name: 'Backend Engineer',
          email: 'backend@example.com',
          role: 'Editor',
          status: 'active',
          joinedAt: now,
        },
      ]);

      await dbInstance.projects.put({
        id: 'proj-default',
        workspaceId: 'ws-default',
        name: 'Core API Project',
        description: 'Primary lifecycle project linking collections, OpenAPI specs, mocks, and contract tests.',
        defaultEnvironmentId: 'env-dev',
        collectionIds: ['col-users', 'col-orders'],
        specIds: ['spec-starter-users'],
        mockServerIds: ['mock-srv-default'],
        isPinned: true,
        lastOpenedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await dbInstance.syncMetadata.put({
        id: 'sync-ws-default',
        workspaceId: 'ws-default',
        providerType: 'local-only',
        status: 'local-only',
        pendingLocalChanges: 0,
        remoteChangesDetected: 0,
        conflicts: [],
        notice:
          'Local workspace active. Remote cloud collaboration requires configuring a future sync server.',
      });
    }

    const specCount = await dbInstance.apiSpecs.count();
    if (specCount === 0) {
      const now = Date.now();
      await dbInstance.apiSpecs.put({
        id: 'spec-starter-users',
        projectId: 'proj-default',
        workspaceId: 'ws-default',
        name: 'API Studio Sample User Service',
        description: 'Starter OpenAPI 3.0 specification for lifecycle exploration and contract testing.',
        version: '1.0.0',
        format: 'yaml',
        sourceType: 'manual',
        content: SAMPLE_OPENAPI_SPEC,
        activeVersionId: 'ver-starter-100',
        validationSummary: { errors: 0, warnings: 0, infos: 0 },
        createdAt: now,
        updatedAt: now,
      });

      await dbInstance.apiVersions.put({
        id: 'ver-starter-100',
        specId: 'spec-starter-users',
        versionLabel: '1.0.0',
        description: 'Initial baseline specification',
        content: SAMPLE_OPENAPI_SPEC,
        format: 'yaml',
        isActive: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    const mockCount = await dbInstance.mockServers.count();
    if (mockCount === 0) {
      const now = Date.now();
      await dbInstance.mockServers.put({
        id: 'mock-srv-default',
        projectId: 'proj-default',
        name: 'Local User Mock Server',
        host: '127.0.0.1',
        port: 4010,
        allowLanExposure: false,
        specId: 'spec-starter-users',
        endpoints: [
          {
            id: 'mock-ep-users',
            serverId: 'mock-srv-default',
            method: 'GET',
            path: '/users',
            enabled: true,
            statusCode: 200,
            headers: { 'X-Mock-Engine': 'API-Studio-Local' },
            contentType: 'application/json',
            delayMs: 25,
            body: JSON.stringify(
              [
                { id: 1, name: 'Leanne Graham', username: 'Bret', email: 'Sincere@april.biz' },
                { id: 2, name: 'Ervin Howell', username: 'Antonette', email: 'Shanna@melissa.tv' },
              ],
              null,
              2
            ),
            description: 'Returns mocked user list',
          },
          {
            id: 'mock-ep-user-by-id',
            serverId: 'mock-srv-default',
            method: 'GET',
            path: '/users/:id',
            enabled: true,
            statusCode: 200,
            headers: { 'X-Mock-Engine': 'API-Studio-Local' },
            contentType: 'application/json',
            delayMs: 15,
            body: JSON.stringify(
              {
                id: '{{path.id}}',
                name: 'Mocked User {{path.id}}',
                requestId: '{{$uuid}}',
                generatedAt: '{{$isoTimestamp}}',
              },
              null,
              2
            ),
            description: 'Dynamic path parameter & safe template response',
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch {
    // ignore if called on an old mock instance
  }
}
