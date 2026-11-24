import { HttpMethod } from './request';

// ===================== 1. OpenAPI & Swagger =====================

export type OpenApiSpecFormat = 'yaml' | 'json';
export type OpenApiVersionKind = 'openapi-3.0' | 'openapi-3.1' | 'swagger-2.0' | 'unknown';

export interface OpenApiValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path: string;
  line: number;
  column: number;
}

export interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface OpenApiRequestBodySpec {
  required: boolean;
  description?: string;
  contentTypes: string[];
  schema?: Record<string, unknown>;
  exampleJson?: string;
}

export interface OpenApiResponseSpec {
  statusCode: string;
  description: string;
  contentTypes: string[];
  schema?: Record<string, unknown>;
  exampleJson?: string;
  headers?: Record<string, { description?: string; schema?: Record<string, unknown> }>;
}

export interface OpenApiEndpointItem {
  id: string;
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  deprecated?: boolean;
  parameters: OpenApiParameter[];
  requestBody?: OpenApiRequestBodySpec;
  responses: OpenApiResponseSpec[];
  security?: Array<Record<string, string[]>>;
}

export interface OpenApiServerEntry {
  url: string;
  description?: string;
}

export interface OpenApiSecuritySchemeEntry {
  name: string;
  type: string;
  scheme?: string;
  in?: string;
  bearerFormat?: string;
  description?: string;
}

export interface OpenApiParsedDoc {
  title: string;
  version: string;
  description?: string;
  specVersionKind: OpenApiVersionKind;
  servers: OpenApiServerEntry[];
  tags: Array<{ name: string; description?: string }>;
  endpoints: OpenApiEndpointItem[];
  schemas: Record<string, Record<string, unknown>>;
  securitySchemes: OpenApiSecuritySchemeEntry[];
  normalizedDocument: Record<string, unknown>;
}

export interface OpenApiSpecRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  description?: string;
  version: string;
  format: OpenApiSpecFormat;
  sourceType: 'file' | 'url' | 'clipboard' | 'manual';
  sourceLocation?: string;
  content: string;
  activeVersionId?: string;
  validationSummary?: {
    errors: number;
    warnings: number;
    infos: number;
  };
  createdAt: number;
  updatedAt: number;
}

// ===================== 2. API Version Management & Diffing =====================

export interface ApiVersionEntry {
  id: string;
  specId: string;
  versionLabel: string;
  description?: string;
  content: string;
  format: OpenApiSpecFormat;
  isActive: boolean;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export type BreakingChangeSeverity = 'breaking' | 'potentially-breaking' | 'non-breaking';

export interface SpecChangeItem {
  id: string;
  category:
    | 'endpoint-removed'
    | 'endpoint-added'
    | 'method-removed'
    | 'method-added'
    | 'param-required-added'
    | 'param-removed'
    | 'param-optional-added'
    | 'request-schema-changed'
    | 'response-schema-changed'
    | 'auth-changed'
    | 'server-changed'
    | 'metadata-changed';
  severity: BreakingChangeSeverity;
  path: string;
  method?: string;
  message: string;
  beforeSummary?: string;
  afterSummary?: string;
}

export interface SpecDiffResult {
  baseVersionId: string;
  targetVersionId: string;
  baseLabel: string;
  targetLabel: string;
  changes: SpecChangeItem[];
  summary: {
    breaking: number;
    potentiallyBreaking: number;
    nonBreaking: number;
    addedEndpoints: number;
    removedEndpoints: number;
  };
  generatedAt: number;
  disclaimer: string;
}

// ===================== 3. API Documentation Generator =====================

export type DocThemeMode = 'dark' | 'light' | 'system';

export interface DocumentationConfig {
  id: string;
  specId: string;
  title: string;
  theme: DocThemeMode;
  includeExamples: boolean;
  includeSchemas: boolean;
  includeSecurity: boolean;
  customHeaderMarkdown?: string;
  updatedAt: number;
}

// ===================== 4. Native API Mocking Server =====================

export interface MockEndpointRule {
  id: string;
  serverId: string;
  method: HttpMethod;
  path: string; // Supports :id or {id} params
  enabled: boolean;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  delayMs: number;
  description?: string;
}

export interface MockServerConfig {
  id: string;
  projectId: string;
  name: string;
  host: string; // Defaults to '127.0.0.1'
  port: number;
  allowLanExposure: boolean;
  specId?: string;
  endpoints: MockEndpointRule[];
  isRunning?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MockRequestLog {
  id: string;
  serverId: string;
  timestamp: number;
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  requestBody: string;
  matchedEndpointId?: string;
  responseStatus: number;
  responseTimeMs: number;
  remoteAddr?: string;
}

export interface MockServerStatus {
  serverId: string;
  running: boolean;
  boundAddress?: string;
  port: number;
  startedAt?: number;
  requestCount: number;
  lastError?: string;
}

// ===================== 5. Contract Testing =====================

export interface ContractValidationIssue {
  id: string;
  stage: 'request' | 'response-status' | 'response-headers' | 'response-body';
  jsonPath: string;
  issueType:
    | 'missing-property'
    | 'type-mismatch'
    | 'unexpected-property'
    | 'status-mismatch'
    | 'missing-header'
    | 'schema-violation'
    | 'unmatched-operation'
    | 'execution-error';
  message: string;
  expected?: string;
  actual?: string;
}

export interface ContractEndpointResult {
  id: string;
  endpointId: string;
  method: HttpMethod;
  path: string;
  requestUrl: string;
  requestId?: string;
  passed: boolean;
  statusCode?: number;
  expectedStatuses: string[];
  durationMs: number;
  issues: ContractValidationIssue[];
}

export interface ContractTestConfig {
  id: string;
  name: string;
  specId: string;
  environmentId?: string;
  baseUrlOverride?: string;
  selectedEndpointIds?: string[];
  strictNoAdditionalProperties?: boolean;
  updatedAt: number;
}

export interface ContractTestReport {
  id: string;
  configId?: string;
  specId: string;
  specName: string;
  environmentName?: string;
  baseUrl: string;
  status: 'passed' | 'failed' | 'stopped';
  startedAt: number;
  completedAt: number;
  durationMs: number;
  totalEndpoints: number;
  passedCount: number;
  failedCount: number;
  results: ContractEndpointResult[];
}

// ===================== 6. Git Integration =====================

export interface GitStatusEntry {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  untracked: boolean;
  modified: boolean;
  deleted: boolean;
}

export interface GitCommitEntry {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  timestamp: number;
  message: string;
}

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  lastCommitHash?: string;
}

export interface GitDiffResult {
  path: string;
  staged: boolean;
  patch: string;
  additions: number;
  deletions: number;
}

export interface GitSecretFinding {
  path: string;
  line: number;
  patternName: string;
  snippet: string;
}

export interface GitRepoConfig {
  id: string;
  projectId: string;
  repoPath: string;
  currentBranch: string;
  authorName: string;
  authorEmail: string;
  lastCommitHash?: string;
  lastSyncedAt?: number;
  updatedAt: number;
}

// ===================== 7. Team Collaboration, Workspaces & Sync =====================

export type WorkspaceType = 'personal' | 'team' | 'project';
export type WorkspaceRole = 'Owner' | 'Admin' | 'Editor' | 'Viewer';

export type PermissionAction =
  | 'workspace:edit'
  | 'workspace:delete'
  | 'workspace:manage-members'
  | 'project:create'
  | 'project:edit'
  | 'project:delete'
  | 'spec:edit'
  | 'collection:edit'
  | 'secrets:manage'
  | 'mock:control'
  | 'git:commit';

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: 'active' | 'invited';
  invitedAt?: number;
  joinedAt?: number;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  description: string;
  type: WorkspaceType;
  ownerName: string;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  defaultEnvironmentId?: string;
  collectionIds: string[];
  specIds: string[];
  mockServerIds: string[];
  isPinned?: boolean;
  lastOpenedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface CollaborationComment {
  id: string;
  workspaceId: string;
  targetType: 'spec' | 'endpoint' | 'collection' | 'request' | 'project';
  targetId: string;
  targetLabel: string;
  authorName: string;
  authorRole: WorkspaceRole;
  body: string;
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityLogEntry {
  id: string;
  workspaceId: string;
  projectId?: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceName: string;
  details?: string;
  timestamp: number;
}

export type SyncStatusState = 'local-only' | 'synced' | 'pending-changes' | 'conflict' | 'offline';

export interface SyncConflictItem {
  id: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  localSummary: string;
  remoteSummary: string;
  resolution?: 'keep-local' | 'accept-remote' | 'duplicate-both';
}

export interface SyncMetadata {
  id: string;
  workspaceId: string;
  providerType: 'local-only' | 'future-collaboration-server';
  status: SyncStatusState;
  pendingLocalChanges: number;
  remoteChangesDetected: number;
  conflicts: SyncConflictItem[];
  lastSyncAttemptAt?: number;
  lastSyncedAt?: number;
  notice: string;
}

export interface ISyncProvider {
  readonly providerName: string;
  readonly isRemoteCapable: boolean;
  getSyncStatus(workspaceId: string): Promise<SyncMetadata>;
  detectConflicts(workspaceId: string): Promise<SyncConflictItem[]>;
  pushLocalChanges(workspaceId: string): Promise<SyncMetadata>;
  pullRemoteChanges(workspaceId: string): Promise<SyncMetadata>;
  resolveConflict(
    workspaceId: string,
    conflictId: string,
    strategy: 'keep-local' | 'accept-remote' | 'duplicate-both'
  ): Promise<SyncMetadata>;
}

// ===================== 8. Project ZIP Import / Export =====================

export interface ProjectArchiveManifest {
  archiveFormat: 'api-studio-project-zip-v1';
  exportedAt: number;
  appVersion: string;
  projectName: string;
  workspaceName: string;
  includesSecrets: boolean;
  counts: {
    collections: number;
    folders: number;
    requests: number;
    environments: number;
    specs: number;
    apiVersions: number;
    mockServers: number;
    testSuites: number;
  };
}

export interface ProjectArchiveValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: ProjectArchiveManifest;
  totalEntries: number;
  totalUncompressedBytes: number;
}

export type ProjectImportConflictStrategy = 'merge-new-ids' | 'skip-existing' | 'overwrite-matching';

export interface ProjectImportPreview {
  validation: ProjectArchiveValidationResult;
  manifest: ProjectArchiveManifest;
  payload: {
    project?: Partial<ProjectRecord>;
    collections: Array<Record<string, unknown>>;
    folders: Array<Record<string, unknown>>;
    requests: Array<Record<string, unknown>>;
    environments: Array<Record<string, unknown>>;
    specs: OpenApiSpecRecord[];
    apiVersions: ApiVersionEntry[];
    documentationConfigs: DocumentationConfig[];
    mockServers: MockServerConfig[];
    testSuites: Array<Record<string, unknown>>;
  };
}
