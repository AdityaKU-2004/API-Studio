import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  generateMockEndpointsFromSpec,
  matchMockRoute,
  renderSafeMockTemplate,
  simulateLocalMockDispatch,
} from '../../services/mocking/mockEngine';
import { parseOpenApiDocument } from '../../services/openapi/openapiParser';
import {
  hasWorkspacePermission,
  LocalOnlySyncProvider,
  scrubSensitiveEnvironmentVariables,
} from '../../services/collaboration/workspaceService';
import {
  buildOAuthAuthorizationUrl,
  generateJwtToken,
  generatePkcePair,
  isOAuthTokenExpired,
  validateOAuthStateParameter,
} from '../../services/auth/oauthService';
import { db } from '../../database/database';
import { MockServerConfig } from '../../types';

describe('Phase 8: Mocking, Collaboration/RBAC, OAuth PKCE & JWT Signing', () => {
  beforeEach(async () => {
    await db.open();
    await db.syncMetadata.clear();
  });

  it('safely renders mock templates without arbitrary JS execution and matches dynamic routes', () => {
    const rendered = renderSafeMockTemplate(
      '{"id":"{{path.userId}}","filter":"{{query.role}}","reqId":"{{$uuid}}","ts":"{{$timestamp}}","bad":"{{process.exit(1)}}"}',
      { pathParams: { userId: 'u-42' }, queryParams: { role: 'admin' } }
    );
    const obj = JSON.parse(rendered);
    expect(obj.id).toBe('u-42');
    expect(obj.filter).toBe('admin');
    expect(obj.reqId.length).toBeGreaterThan(8);
    expect(Number(obj.ts)).toBeGreaterThan(1_000_000_000);
    expect(obj.bad).toBe('{{process.exit(1)}}');

    const server: MockServerConfig = {
      id: 'srv-1',
      projectId: 'proj-1',
      name: 'Users Mock',
      host: '127.0.0.1',
      port: 4010,
      allowLanExposure: false,
      endpoints: [
        {
          id: 'r1',
          serverId: 'srv-1',
          method: 'GET',
          path: '/users/:userId',
          enabled: true,
          statusCode: 200,
          headers: { 'X-Env': 'mock' },
          contentType: 'application/json',
          delayMs: 5,
          body: '{"userId":"{{path.userId}}","expand":"{{query.expand}}"}',
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };

    const match = matchMockRoute(server.endpoints, 'GET', '/users/99?expand=roles');
    expect(match.endpoint?.id).toBe('r1');
    expect(match.pathParams.userId).toBe('99');
    expect(match.queryParams.expand).toBe('roles');

    const sim = simulateLocalMockDispatch(server, 'GET', '/users/99?expand=roles');
    expect(sim.status).toBe(200);
    expect(JSON.parse(sim.body)).toEqual({ userId: '99', expand: 'roles' });
    expect(sim.log.remoteAddr).toBe('in-app-simulator');

    const miss = simulateLocalMockDispatch(server, 'DELETE', '/users/99');
    expect(miss.status).toBe(404);
  });

  it('generates mock rules from OpenAPI specifications', () => {
    const parsed = parseOpenApiDocument(`openapi: 3.0.0
info:
  title: Items
  version: 1.0.0
paths:
  /items/{itemId}:
    get:
      responses:
        '200':
          description: Item
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                    example: item-7
`);
    const rules = generateMockEndpointsFromSpec('srv-2', parsed);
    expect(rules).toHaveLength(1);
    expect(rules[0].path).toBe('/items/:itemId');
    expect(rules[0].body).toContain('item-7');
  });

  it('enforces RBAC role permissions, scrubs environment secrets, and exposes local-only sync status', async () => {
    expect(hasWorkspacePermission('Owner', 'workspace:delete')).toBe(true);
    expect(hasWorkspacePermission('Admin', 'workspace:manage-members')).toBe(true);
    expect(hasWorkspacePermission('Admin', 'workspace:delete')).toBe(false);
    expect(hasWorkspacePermission('Editor', 'spec:edit')).toBe(true);
    expect(hasWorkspacePermission('Editor', 'secrets:manage')).toBe(false);
    expect(hasWorkspacePermission('Viewer', 'spec:edit')).toBe(false);

    const scrubbed = scrubSensitiveEnvironmentVariables([
      {
        id: 'env-1',
        name: 'Prod',
        variables: [
          { key: 'BASE_URL', initialValue: 'https://api.prod', currentValue: 'https://api.prod', enabled: true },
          { key: 'API_SECRET_TOKEN', initialValue: 'topsecret', currentValue: 'topsecret', isSecret: true, enabled: true },
        ],
      },
    ]);
    expect((scrubbed[0].variables as any)[0].currentValue).toBe('https://api.prod');
    expect((scrubbed[0].variables as any)[1].currentValue).toBe('');
    expect((scrubbed[0].variables as any)[1].scrubbed).toBe(true);

    const sync = new LocalOnlySyncProvider();
    expect(sync.isRemoteCapable).toBe(false);
    const meta = await sync.pushLocalChanges('ws-test');
    expect(meta.status).toBe('local-only');
    expect(meta.notice.toLowerCase()).toContain('no remote collaboration server configured');
  });

  it('generates PKCE S256 verifier/challenge, validates CSRF state, and signs HS256 JWT tokens', async () => {
    const pkce = await generatePkcePair();
    expect(pkce.method).toBe('S256');
    expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce.codeChallenge.length).toBeGreaterThanOrEqual(43);
    expect(pkce.state.length).toBeGreaterThan(10);

    expect(validateOAuthStateParameter(pkce.state, pkce.state)).toBe(true);
    expect(validateOAuthStateParameter(pkce.state, `${pkce.state}x`)).toBe(false);

    const authUrl = buildOAuthAuthorizationUrl({
      grantType: 'authorization_code_pkce',
      authUrl: 'https://auth.example.com/authorize',
      accessTokenUrl: 'https://auth.example.com/token',
      clientId: 'cli-123',
      clientSecret: '',
      scope: 'read write',
      redirectUri: 'https://localhost:3000/cb',
      clientAuthMethod: 'header',
      pkceChallenge: pkce.codeChallenge,
      pkceMethod: 'S256',
      state: pkce.state,
    });
    expect(authUrl).toContain(`code_challenge=${pkce.codeChallenge}`);
    expect(authUrl).toContain('code_challenge_method=S256');

    const jwt = await generateJwtToken({
      algorithm: 'HS256',
      secretOrPrivateKey: 'my-super-secret-signing-key',
      payloadJson: JSON.stringify({ sub: 'usr-99', role: 'admin' }),
      addTo: 'header',
      expiresInSeconds: 3600,
    });
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);

    expect(isOAuthTokenExpired(Date.now() - 10_000)).toBe(true);
    expect(isOAuthTokenExpired(Date.now() + 120_000)).toBe(false);
  });
});
