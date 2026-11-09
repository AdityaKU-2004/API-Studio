import { CollectionItem, Environment, HistoryItem, Workspace, ApiRequest, ApiResponse } from '../types';

export const initialWorkspaces: Workspace[] = [
  { id: 'ws-default', name: 'Acme Cloud API', description: 'Main microservices and public endpoints' },
  { id: 'ws-internal', name: 'Internal Services', description: 'Billing, logging, and metrics services' },
  { id: 'ws-sandbox', name: 'Sandbox Experiments', description: 'Testing experimental schemas' },
];

const defaultMockSettings = {
  timeout: 5000,
  followRedirects: true,
  maxRedirects: 5,
  autoEncodeUrl: true,
  sslVerification: true,
  allowInsecureCertificates: false,
  httpVersion: 'auto' as const,
  connectionTimeout: 5000,
  keepAlive: true,
  disableCache: false,
  followAuthRedirects: true,
  customUserAgent: 'API Studio/2.0',
};

export const sampleRequests: Record<string, ApiRequest> = {
  'req-user-get-all': {
    id: 'req-user-get-all',
    name: 'Get All Users',
    method: 'GET',
    url: '{{base_url}}/users',
    params: [
      { id: 'p1', key: 'page', value: '1', description: 'Page index', enabled: true },
      { id: 'p2', key: 'limit', value: '10', description: 'Records per page', enabled: true },
      { id: 'p3', key: 'status', value: 'active', description: 'Filter by active users', enabled: false },
    ],
    headers: [
      { id: 'h1', key: 'Accept', value: 'application/json', description: 'Expected response format', enabled: true },
      { id: 'h2', key: 'X-API-Version', value: '2026-03-01', description: 'API version identifier', enabled: true },
    ],
    auth: { type: 'bearer', bearer: { token: '{{auth_token}}', prefix: 'Bearer' } },
    bodyType: 'none',
    rawBody: '',
    formData: [],
    urlEncoded: [],
    preRequestScript: '// Set request timestamp\npm.variables.set("request_time", Date.now());',
    testScript: 'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});\n\npm.test("Response time is less than 500ms", function () {\n  pm.expect(pm.response.responseTime).to.be.below(500);\n});\n\npm.test("Users array is populated", function () {\n  const jsonData = pm.response.json();\n  pm.expect(jsonData.users).to.be.an("array");\n});',
    body: { mode: 'none', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '// Set request timestamp\npm.variables.set("request_time", Date.now());', enabled: true },
      postResponse: { script: 'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});', enabled: true },
    },
    settings: { ...defaultMockSettings, timeout: 5000 },
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-user-get-id': {
    id: 'req-user-get-id',
    name: 'Get User by ID',
    method: 'GET',
    url: '{{base_url}}/users/104',
    params: [
      { id: 'p1', key: 'include_profile', value: 'true', description: 'Fetch nested profile', enabled: true },
    ],
    headers: [
      { id: 'h1', key: 'Accept', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'bearer', bearer: { token: '{{auth_token}}', prefix: 'Bearer' } },
    bodyType: 'none',
    rawBody: '',
    formData: [],
    urlEncoded: [],
    preRequestScript: '',
    testScript: 'pm.test("User ID matches", function () {\n  const data = pm.response.json();\n  pm.expect(data.id).to.eql(104);\n});',
    body: { mode: 'none', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: 'pm.test("User ID matches", function () {\n  const data = pm.response.json();\n  pm.expect(data.id).to.eql(104);\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-user-create': {
    id: 'req-user-create',
    name: 'Create User',
    method: 'POST',
    url: '{{base_url}}/users',
    params: [],
    headers: [
      { id: 'h1', key: 'Content-Type', value: 'application/json', description: 'Payload MIME type', enabled: true },
      { id: 'h2', key: 'Accept', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'bearer', bearer: { token: '{{auth_token}}', prefix: 'Bearer' } },
    bodyType: 'json',
    rawBody: JSON.stringify(
      {
        name: 'Sarah Connor',
        email: 'sarah.connor@acmecloud.io',
        role: 'lead_architect',
        department: 'Infrastructure',
        preferences: {
          theme: 'dark',
          notifications: true,
          region: 'us-west-2'
        }
      },
      null,
      2
    ),
    formData: [],
    urlEncoded: [],
    preRequestScript: '// Generate unique client trace ID\npm.variables.set("trace_id", "trace_" + Math.random().toString(36).substring(7));',
    testScript: 'pm.test("Status code is 201 Created", function () {\n  pm.response.to.have.status(201);\n});\n\npm.test("User object has generated ID", function () {\n  const res = pm.response.json();\n  pm.expect(res).to.have.property("id");\n});',
    body: {
      mode: 'json',
      rawContent: {},
      formData: [],
      urlEncoded: [],
      binary: {},
    },
    scripts: {
      preRequest: { script: '// Generate unique client trace ID\npm.variables.set("trace_id", "trace_" + Math.random().toString(36).substring(7));', enabled: true },
      postResponse: { script: 'pm.test("Status code is 201 Created", function () {\n  pm.response.to.have.status(201);\n});', enabled: true },
    },
    settings: { ...defaultMockSettings, timeout: 10000 },
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-user-update': {
    id: 'req-user-update',
    name: 'Update User',
    method: 'PUT',
    url: '{{base_url}}/users/104',
    params: [],
    headers: [
      { id: 'h1', key: 'Content-Type', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'bearer', bearer: { token: '{{auth_token}}', prefix: 'Bearer' } },
    bodyType: 'json',
    rawBody: JSON.stringify(
      {
        name: 'Sarah Connor-Reese',
        role: 'chief_architect',
        status: 'active'
      },
      null,
      2
    ),
    formData: [],
    urlEncoded: [],
    preRequestScript: '',
    testScript: 'pm.test("Update successful", function () {\n  pm.response.to.have.status(200);\n});',
    body: { mode: 'json', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: 'pm.test("Update successful", function () {\n  pm.response.to.have.status(200);\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-user-delete': {
    id: 'req-user-delete',
    name: 'Delete User',
    method: 'DELETE',
    url: '{{base_url}}/users/104',
    params: [],
    headers: [
      { id: 'h1', key: 'X-Confirm-Delete', value: 'true', description: 'Confirmation guard', enabled: true },
    ],
    auth: { type: 'bearer', bearer: { token: '{{auth_token}}', prefix: 'Bearer' } },
    bodyType: 'none',
    rawBody: '',
    formData: [],
    urlEncoded: [],
    preRequestScript: '',
    testScript: 'pm.test("Status code is 204 No Content", function () {\n  pm.response.to.have.status(204);\n});',
    body: { mode: 'none', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: 'pm.test("Status code is 204 No Content", function () {\n  pm.response.to.have.status(204);\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-prod-get-all': {
    id: 'req-prod-get-all',
    name: 'Get Products',
    method: 'GET',
    url: '{{base_url}}/products',
    params: [
      { id: 'p1', key: 'category', value: 'cloud-compute', description: 'Filter category', enabled: true },
      { id: 'p2', key: 'sort', value: 'price_asc', description: 'Sort order', enabled: true },
    ],
    headers: [
      { id: 'h1', key: 'Accept', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'none' },
    bodyType: 'none',
    rawBody: '',
    formData: [],
    urlEncoded: [],
    preRequestScript: '',
    testScript: 'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});',
    body: { mode: 'none', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: 'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-prod-get-id': {
    id: 'req-prod-get-id',
    name: 'Get Product Details',
    method: 'GET',
    url: '{{base_url}}/products/prd-901',
    params: [],
    headers: [
      { id: 'h1', key: 'Accept', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'none' },
    bodyType: 'none',
    rawBody: '',
    formData: [],
    urlEncoded: [],
    preRequestScript: '',
    testScript: 'pm.test("Product SKU found", function () {\n  const p = pm.response.json();\n  pm.expect(p.sku).to.be.a("string");\n});',
    body: { mode: 'none', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: 'pm.test("Product SKU found", function () {\n  const p = pm.response.json();\n  pm.expect(p.sku).to.be.a("string");\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-prod-create': {
    id: 'req-prod-create',
    name: 'Create Product',
    method: 'POST',
    url: '{{base_url}}/products',
    params: [],
    headers: [
      { id: 'h1', key: 'Content-Type', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'apikey', apikey: { key: 'X-API-Key', value: '{{api_key}}', addTo: 'header', enabled: true } },
    bodyType: 'json',
    rawBody: JSON.stringify(
      {
        title: 'Cloud Enterprise Dedicated Cluster',
        sku: 'CLD-ENT-4X',
        price: 1299.00,
        currency: 'USD',
        specs: {
          vCPU: 32,
          ramGB: 128,
          storageTB: 2,
          nvme: true
        }
      },
      null,
      2
    ),
    formData: [],
    urlEncoded: [],
    preRequestScript: '',
    testScript: 'pm.test("Status code is 201", function () {\n  pm.response.to.have.status(201);\n});',
    body: { mode: 'json', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: 'pm.test("Status code is 201", function () {\n  pm.response.to.have.status(201);\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-auth-login': {
    id: 'req-auth-login',
    name: 'Login',
    method: 'POST',
    url: '{{base_url}}/auth/login',
    params: [],
    headers: [
      { id: 'h1', key: 'Content-Type', value: 'application/json', description: '', enabled: true },
      { id: 'h2', key: 'X-Device-Id', value: 'desktop-macos-arm64', description: '', enabled: true },
    ],
    auth: { type: 'none' },
    bodyType: 'json',
    rawBody: JSON.stringify(
      {
        email: 'developer@acmecloud.io',
        password: '••••••••••••',
        rememberMe: true
      },
      null,
      2
    ),
    formData: [],
    urlEncoded: [],
    preRequestScript: '// Clear previous session tokens\npm.environment.unset("auth_token");',
    testScript: 'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});\n\npm.test("Store access token in environment", function () {\n  const res = pm.response.json();\n  pm.environment.set("auth_token", res.accessToken);\n});',
    body: { mode: 'json', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '// Clear previous session tokens\npm.environment.unset("auth_token");', enabled: true },
      postResponse: { script: 'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-auth-register': {
    id: 'req-auth-register',
    name: 'Register',
    method: 'POST',
    url: '{{base_url}}/auth/register',
    params: [],
    headers: [
      { id: 'h1', key: 'Content-Type', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'none' },
    bodyType: 'json',
    rawBody: JSON.stringify(
      {
        organization: 'Acme Robotics Corp',
        adminEmail: 'admin@acmerobotics.io',
        plan: 'developer_team',
        agreeTerms: true
      },
      null,
      2
    ),
    formData: [],
    urlEncoded: [],
    preRequestScript: '',
    testScript: 'pm.test("Registration initiated", function () {\n  pm.response.to.have.status(201);\n});',
    body: { mode: 'json', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: 'pm.test("Registration initiated", function () {\n  pm.response.to.have.status(201);\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  'req-auth-refresh': {
    id: 'req-auth-refresh',
    name: 'Refresh Token',
    method: 'POST',
    url: '{{base_url}}/auth/refresh',
    params: [],
    headers: [
      { id: 'h1', key: 'Content-Type', value: 'application/json', description: '', enabled: true },
    ],
    auth: { type: 'bearer', bearer: { token: '{{refresh_token}}', prefix: 'Bearer' } },
    bodyType: 'json',
    rawBody: JSON.stringify(
      {
        refreshToken: 'rtk_live_89172648719263912'
      },
      null,
      2
    ),
    formData: [],
    urlEncoded: [],
    preRequestScript: '',
    testScript: 'pm.test("New tokens received", function () {\n  pm.response.to.have.status(200);\n});',
    body: { mode: 'json', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: true },
      postResponse: { script: 'pm.test("New tokens received", function () {\n  pm.response.to.have.status(200);\n});', enabled: true },
    },
    settings: defaultMockSettings,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
};

export const initialCollections: CollectionItem[] = [
  {
    id: 'col-users',
    name: 'User Management',
    type: 'collection',
    description: 'CRUD operations for organization users, roles, and profiles',
    isExpanded: true,
    children: [
      { id: 'c-user-1', name: 'Get All Users', type: 'request', requestId: 'req-user-get-all', request: sampleRequests['req-user-get-all'] },
      { id: 'c-user-2', name: 'Get User by ID', type: 'request', requestId: 'req-user-get-id', request: sampleRequests['req-user-get-id'] },
      { id: 'c-user-3', name: 'Create User', type: 'request', requestId: 'req-user-create', request: sampleRequests['req-user-create'] },
      { id: 'c-user-4', name: 'Update User', type: 'request', requestId: 'req-user-update', request: sampleRequests['req-user-update'] },
      { id: 'c-user-5', name: 'Delete User', type: 'request', requestId: 'req-user-delete', request: sampleRequests['req-user-delete'] },
    ],
  },
  {
    id: 'col-products',
    name: 'Product API',
    type: 'collection',
    description: 'Catalog query, SKU inventory, and product configuration endpoints',
    isExpanded: true,
    children: [
      { id: 'c-prod-1', name: 'Get Products', type: 'request', requestId: 'req-prod-get-all', request: sampleRequests['req-prod-get-all'] },
      { id: 'c-prod-2', name: 'Get Product Details', type: 'request', requestId: 'req-prod-get-id', request: sampleRequests['req-prod-get-id'] },
      { id: 'c-prod-3', name: 'Create Product', type: 'request', requestId: 'req-prod-create', request: sampleRequests['req-prod-create'] },
    ],
  },
  {
    id: 'col-auth',
    name: 'Authentication',
    type: 'collection',
    description: 'OAuth2 and session token issuance, validation, and renewal',
    isExpanded: true,
    children: [
      { id: 'c-auth-1', name: 'Login', type: 'request', requestId: 'req-auth-login', request: sampleRequests['req-auth-login'] },
      { id: 'c-auth-2', name: 'Register', type: 'request', requestId: 'req-auth-register', request: sampleRequests['req-auth-register'] },
      { id: 'c-auth-3', name: 'Refresh Token', type: 'request', requestId: 'req-auth-refresh', request: sampleRequests['req-auth-refresh'] },
    ],
  },
];

export const initialEnvironments: Environment[] = [
  {
    id: 'env-dev',
    name: 'Development',
    isDefault: true,
    variables: [
      { id: 'v1', key: 'base_url', initialValue: 'https://dev-api.acmecloud.io/v1', currentValue: 'https://dev-api.acmecloud.io/v1', description: 'Development gateway URL', enabled: true },
      { id: 'v2', key: 'api_key', initialValue: 'dev_sec_9918237198', currentValue: 'dev_sec_9918237198', description: 'Internal testing service API key', enabled: true },
      { id: 'v3', key: 'auth_token', initialValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev_mock_token_abc123', currentValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev_mock_token_abc123', description: 'Bearer session token for sandbox', enabled: true },
      { id: 'v4', key: 'refresh_token', initialValue: 'rtk_dev_108239019230', currentValue: 'rtk_dev_108239019230', description: 'Refresh token for session cycling', enabled: true },
    ],
  },
  {
    id: 'env-staging',
    name: 'Testing',
    variables: [
      { id: 'v1', key: 'base_url', initialValue: 'https://staging-api.acmecloud.io/v1', currentValue: 'https://staging-api.acmecloud.io/v1', description: 'Staging integration gateway', enabled: true },
      { id: 'v2', key: 'api_key', initialValue: 'stage_sec_8829102938', currentValue: 'stage_sec_8829102938', description: 'QA testing key', enabled: true },
      { id: 'v3', key: 'auth_token', initialValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.staging_token_qa456', currentValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.staging_token_qa456', description: 'Staging auth token', enabled: true },
      { id: 'v4', key: 'refresh_token', initialValue: 'rtk_stage_8827361829', currentValue: 'rtk_stage_8827361829', description: 'Staging refresh token', enabled: true },
    ],
  },
  {
    id: 'env-prod',
    name: 'Production',
    variables: [
      { id: 'v1', key: 'base_url', initialValue: 'https://api.acmecloud.io/v1', currentValue: 'https://api.acmecloud.io/v1', description: 'Live production API gateway', enabled: true },
      { id: 'v2', key: 'api_key', initialValue: 'prod_live_3901827491', currentValue: 'prod_live_3901827491', description: 'Production API secret key', enabled: true },
      { id: 'v3', key: 'auth_token', initialValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod_token_sec789', currentValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod_token_sec789', description: 'Production JWT token', enabled: true },
      { id: 'v4', key: 'refresh_token', initialValue: 'rtk_prod_9918237192', currentValue: 'rtk_prod_9918237192', description: 'Production refresh token', enabled: true },
    ],
  },
];

export const initialHistory: HistoryItem[] = [
  {
    id: 'hist-1',
    method: 'GET',
    url: 'https://dev-api.acmecloud.io/v1/users',
    status: 200,
    statusText: 'OK',
    timeMs: 142,
    timestamp: Date.now() - 1000 * 60 * 12,
    request: sampleRequests['req-user-get-all'],
  },
  {
    id: 'hist-2',
    method: 'POST',
    url: 'https://dev-api.acmecloud.io/v1/auth/login',
    status: 200,
    statusText: 'OK',
    timeMs: 218,
    timestamp: Date.now() - 1000 * 60 * 35,
    request: sampleRequests['req-auth-login'],
  },
  {
    id: 'hist-3',
    method: 'POST',
    url: 'https://dev-api.acmecloud.io/v1/users',
    status: 201,
    statusText: 'Created',
    timeMs: 165,
    timestamp: Date.now() - 1000 * 60 * 68,
    request: sampleRequests['req-user-create'],
  },
  {
    id: 'hist-4',
    method: 'GET',
    url: 'https://dev-api.acmecloud.io/v1/products',
    status: 200,
    statusText: 'OK',
    timeMs: 189,
    timestamp: Date.now() - 1000 * 60 * 120,
    request: sampleRequests['req-prod-get-all'],
  },
  {
    id: 'hist-5',
    method: 'DELETE',
    url: 'https://dev-api.acmecloud.io/v1/users/104',
    status: 204,
    statusText: 'No Content',
    timeMs: 110,
    timestamp: Date.now() - 1000 * 60 * 240,
    request: sampleRequests['req-user-delete'],
  },
];

export const mockResponsesByUrl: Record<string, Partial<ApiResponse>> = {
  '/users': {
    status: 200,
    statusText: 'OK',
    body: JSON.stringify(
      {
        status: 'success',
        page: 1,
        per_page: 10,
        total: 2,
        data: [
          {
            id: 101,
            name: 'Alex Vance',
            email: 'alex.vance@acmecloud.io',
            role: 'lead_engineer',
            avatar_url: 'https://images.unsplash.com/placeholder-avatar-1',
            status: 'active',
            createdAt: '2026-01-14T08:30:00Z',
            preferences: {
              theme: 'dark',
              notifications: true,
              desktop_client: 'API Studio v1.2'
            }
          },
          {
            id: 104,
            name: 'Sarah Connor',
            email: 'sarah.connor@acmecloud.io',
            role: 'lead_architect',
            avatar_url: 'https://images.unsplash.com/placeholder-avatar-2',
            status: 'active',
            createdAt: '2026-02-01T11:15:00Z',
            preferences: {
              theme: 'dark',
              notifications: true,
              desktop_client: 'API Studio v1.2'
            }
          }
        ]
      },
      null,
      2
    ),
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60',
      'x-request-id': 'req_981a287f-4421-49b8-b86e-92716491',
      'x-ratelimit-limit': '1000',
      'x-ratelimit-remaining': '984',
      'server': 'cloudflare-workers',
      'access-control-allow-origin': '*',
    },
    cookies: [
      { name: 'session_id', value: 'sess_99182371982', domain: 'acmecloud.io', path: '/', httpOnly: true, secure: true, expires: '2026-12-31T23:59:59Z' },
      { name: 'device_trust', value: 'trusted_mac_client', domain: 'acmecloud.io', path: '/', secure: true },
    ],
    tests: [
      { name: 'Status code is 200 OK', passed: true },
      { name: 'Response time is under 500ms', passed: true },
      { name: 'Payload contains data array with items', passed: true },
      { name: 'Content-Type header is JSON', passed: true },
    ],
  },
  '/auth/login': {
    status: 200,
    statusText: 'OK',
    body: JSON.stringify(
      {
        status: 'authenticated',
        tokenType: 'Bearer',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfOTA5MiIsIm5hbWUiOiJEZXZlbG9wZXIiLCJyb2xlcyI6WyJhZG1pbiJdfQ.sig8921739',
        expiresIn: 86400,
        refreshToken: 'rtk_live_89172648719263912',
        user: {
          id: 'usr_9092',
          email: 'developer@acmecloud.io',
          name: 'Developer Account',
          permissions: ['api:read', 'api:write', 'collections:manage', 'environments:admin']
        }
      },
      null,
      2
    ),
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': 'refresh_token=rtk_live_89172648719263912; Path=/auth; HttpOnly; Secure; SameSite=Strict',
      'x-auth-session-id': 'auth_sess_3901928419',
    },
    cookies: [
      { name: 'refresh_token', value: 'rtk_live_89172648719263912', domain: 'acmecloud.io', path: '/auth', httpOnly: true, secure: true },
    ],
    tests: [
      { name: 'Authentication successful', passed: true },
      { name: 'Access token provided in body', passed: true },
      { name: 'Refresh token cookie set as HttpOnly', passed: true },
    ],
  },
};
