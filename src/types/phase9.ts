import { HttpMethod } from './request';
import { ApiResponse } from './response';

// ===================== 1. Performance & Load Testing =====================

export type LoadTestMode = 'smoke' | 'load' | 'stress' | 'spike' | 'soak';

export interface PerformanceTestConfig {
  id: string;
  name: string;
  collectionId?: string;
  requestIds: string[];
  environmentId?: string;
  mode: LoadTestMode;
  virtualUsers: number; // Guardrail: 1..200
  durationSeconds: number; // Guardrail: 1..1800
  rampUpSeconds: number;
  rampDownSeconds: number;
  requestDelayMs: number;
  maxRequestsPerSecond: number; // Guardrail: 1..1000
  timeoutMs: number;
  errorThresholdPercent: number; // 0..100
  confirmedExecution?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PerformanceMetricSample {
  id: string;
  runId: string;
  timestamp: number;
  elapsedSeconds: number;
  activeVirtualUsers: number;
  currentRps: number;
  avgResponseTimeMs: number;
  errorRatePercent: number;
  throughputBytesPerSec: number;
  statusCodes: Record<string, number>;
}

export interface PerformanceMetricsSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeoutCount: number;
  requestsPerSecond: number;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  medianResponseTimeMs: number;
  p90ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  errorRatePercent: number;
  totalBytesReceived: number;
  throughputBytesPerSec: number;
  statusCodeDistribution: Record<string, number>;
  sampleCount: number;
  percentilesApproximate: boolean;
  percentileNote?: string;
}

export interface PerformanceTestRun {
  id: string;
  configId: string;
  configSnapshot: PerformanceTestConfig;
  environmentName?: string;
  targetEndpoints: string[];
  status: 'running' | 'completed' | 'stopped' | 'failed';
  startedAt: number;
  completedAt?: number;
  durationMs: number;
  summary: PerformanceMetricsSummary;
  errorMessage?: string;
}

// ===================== 2. API Security Auditing =====================

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type SecurityFindingCategory =
  | 'https'
  | 'tls'
  | 'security-headers'
  | 'authentication'
  | 'info-exposure'
  | 'openapi-spec'
  | 'active-validation';

export type SecurityFindingStatus = 'open' | 'resolved' | 'accepted-risk';

export interface SecurityAuditConfig {
  id: string;
  name: string;
  collectionId?: string;
  specId?: string;
  environmentId?: string;
  includePassiveHttps: boolean;
  includeTlsInspection: boolean;
  includeSecurityHeaders: boolean;
  includeAuthChecks: boolean;
  includeInfoExposure: boolean;
  includeOpenApiAnalysis: boolean;
  includeControlledActiveTests: boolean;
  confirmedActiveAuthorization: boolean;
  customExposurePatterns: string[];
  updatedAt: number;
}

export interface SecurityFinding {
  id: string;
  auditId: string;
  title: string;
  severity: SecuritySeverity;
  category: SecurityFindingCategory;
  affectedEndpoint: string;
  specLocation?: string;
  evidence: string;
  explanation: string;
  remediation: string;
  status: SecurityFindingStatus;
  notes?: string;
  detectedAt: number;
}

export interface SecurityAuditReport {
  id: string;
  configId: string;
  name: string;
  startedAt: number;
  completedAt: number;
  findings: SecurityFinding[];
  summaryCounts: Record<SecuritySeverity, number>;
}

// ===================== 3. CI/CD Integration =====================

export type CiProviderType = 'github-actions' | 'gitlab-ci' | 'jenkins' | 'shell';

export type PipelineTemplateKind =
  | 'basic-tests'
  | 'full-regression'
  | 'contract-validation'
  | 'security-checks'
  | 'smoke-tests';

export interface CiPipelineOptions {
  provider: CiProviderType;
  template: PipelineTemplateKind;
  projectName: string;
  collectionName: string;
  environmentName: string;
  suiteName?: string;
  specPath?: string;
  runContractTests: boolean;
  runSecurityChecks: boolean;
  validateOpenApi: boolean;
  reportFormat: 'json' | 'junit-xml' | 'html' | 'csv';
  timeoutSeconds: number;
}

// ===================== 4. Automated API Monitoring & Health =====================

export type MonitorProtocolType = 'http' | 'graphql' | 'tcp' | 'websocket' | 'sse';

export type HealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown';

export interface MonitorConfig {
  id: string;
  name: string;
  protocol: MonitorProtocolType;
  endpoint: string; // HTTP(S) URL, ws(s):// URL, or host:port for TCP
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
  environmentId?: string;
  expectedStatuses: number[];
  expectedContentSubstring?: string;
  timeoutMs: number;
  intervalSeconds: number;
  degradedLatencyMs: number;
  enabled: boolean;
  paused: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MonitorCheckResult {
  id: string;
  monitorId: string;
  timestamp: number;
  status: HealthStatus;
  statusCode?: number;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
}

export interface AlertConfig {
  id: string;
  monitorId: string;
  name: string;
  desktopNotification: boolean;
  inAppNotification: boolean;
  webhookEnabled: boolean;
  webhookUrl?: string;
  webhookSecretRef?: string;
  alertOnFailure: boolean;
  alertOnRecovery: boolean;
  latencyThresholdMs?: number;
  updatedAt: number;
}

export interface MonitorMetricsSummary {
  monitorId: string;
  currentStatus: HealthStatus;
  availabilityPercent: number;
  avgResponseTimeMs: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  totalChecks: number;
  failureCount: number;
  consecutiveFailures: number;
}

// ===================== 5. Observability & Trace Correlation =====================

export interface TraceCorrelationIds {
  traceparent?: string;
  tracestate?: string;
  xRequestId?: string;
  xCorrelationId?: string;
  localTrackingId: string;
  transmittedHeadersPresent: boolean;
}

export type ObservabilityErrorCategory =
  | 'http-status'
  | 'network'
  | 'tls'
  | 'timeout'
  | 'authentication'
  | 'dns'
  | 'application'
  | 'none';

export interface RequestTraceEntry {
  id: string;
  requestId: string;
  collectionName?: string;
  environmentName?: string;
  host: string;
  method: HttpMethod;
  url: string;
  statusCode: number;
  responseSizeBytes: number;
  startTime: number;
  durationMs: number;
  dnsMs?: number | null;
  tcpMs?: number | null;
  tlsMs?: number | null;
  ttfbMs?: number;
  downloadMs?: number;
  errorCategory: ObservabilityErrorCategory;
  errorDetails?: string;
  correlation: TraceCorrelationIds;
  redactedRequestHeaders: Record<string, string>;
  redactedResponseHeaders: Record<string, string>;
}

export interface RedactionConfig {
  redactHeaders: string[];
  redactJsonKeys: string[];
  maskStyle: 'partial' | 'full';
}

// ===================== 6. Database Development Tools =====================

export type DatabaseEngineType = 'sqlite' | 'postgresql' | 'mysql';

export interface DatabaseConnectionProfile {
  id: string;
  name: string;
  engine: DatabaseEngineType;
  host?: string;
  port?: number;
  databaseName: string; // File path for SQLite or DB name for Postgres/MySQL
  username?: string;
  credentialRef?: string; // OS keyring reference (NEVER store plaintext password in SQLite!)
  readOnlyDefault: boolean;
  sslMode?: 'disable' | 'prefer' | 'require';
  createdAt: number;
  updatedAt: number;
}

export interface DatabaseColumnMeta {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

export interface DatabaseForeignKeyMeta {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface DatabaseTableMeta {
  schemaName: string;
  tableName: string;
  tableType: 'table' | 'view';
  columns: DatabaseColumnMeta[];
  indexes: Array<{ name: string; columns: string[]; unique: boolean }>;
  foreignKeys: DatabaseForeignKeyMeta[];
}

export interface DatabaseSchemaSnapshot {
  databaseName: string;
  schemas: string[];
  tables: DatabaseTableMeta[];
  inspectedAt: number;
}

export interface SqlQueryHistoryItem {
  id: string;
  profileId: string;
  sql: string;
  executedAt: number;
  durationMs: number;
  rowCount: number;
  success: boolean;
  errorMessage?: string;
  readOnlyMode: boolean;
}

export interface SqlQueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  affectedRows?: number;
  durationMs: number;
  warnings: string[];
}

// ===================== 7. Environment Comparison & Validation =====================

export type EnvironmentProfileType =
  | 'local'
  | 'development'
  | 'testing'
  | 'staging'
  | 'production'
  | 'custom';

export interface EnvironmentDiffEntry {
  key: string;
  changeType: 'added' | 'removed' | 'changed' | 'unchanged';
  leftValueMasked?: string;
  rightValueMasked?: string;
  isSecret: boolean;
}

export interface EnvironmentValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  key: string;
  category:
    | 'missing-required'
    | 'invalid-url'
    | 'invalid-type'
    | 'unresolved-reference'
    | 'duplicate-key'
    | 'invalid-secret-ref';
  message: string;
}

export interface EnvironmentValidationResult {
  id: string;
  environmentId: string;
  environmentName: string;
  checkedAt: number;
  valid: boolean;
  issues: EnvironmentValidationIssue[];
}

export interface EnvironmentTemplateFile {
  templateFormat: 'api-studio-env-template-v1';
  name: string;
  profileType: EnvironmentProfileType;
  description?: string;
  includesSecrets: false;
  exportedAt: number;
  variables: Array<{
    key: string;
    initialValue: string;
    description: string;
    isSecret: boolean;
    enabled: boolean;
  }>;
}

// ===================== 8. API Dependency Analysis =====================

export type DependencyNodeKind = 'api' | 'service' | 'endpoint' | 'collection' | 'environment' | 'variable';

export type DependencyEdgeKind = 'uses' | 'calls' | 'depends-on' | 'shares-auth' | 'references';

export interface DependencyNode {
  id: string;
  label: string;
  kind: DependencyNodeKind;
  subtitle?: string;
  x: number;
  y: number;
}

export interface DependencyEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: DependencyEdgeKind;
  certainty: 'explicit' | 'inferred';
  evidence: string;
}

export interface DependencyGraphData {
  id: string;
  name: string;
  generatedAt: number;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

// ===================== 9. Automation Workflows =====================

export type WorkflowStepType =
  | 'http-request'
  | 'graphql-request'
  | 'set-variable'
  | 'read-variable'
  | 'condition'
  | 'delay'
  | 'assertion'
  | 'json-transform'
  | 'extract-response'
  | 'run-collection'
  | 'generate-report';

export interface WorkflowStepConfig {
  id: string;
  name: string;
  type: WorkflowStepType;
  enabled: boolean;
  timeoutMs: number;
  retryCount: number;
  continueOnError: boolean;
  // Step type payloads
  requestId?: string;
  method?: HttpMethod;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  graphqlQuery?: string;
  graphqlVariablesJson?: string;
  variableKey?: string;
  variableValue?: string;
  isEphemeralSecret?: boolean;
  jsonPath?: string; // for extract-response / json-transform
  conditionExpression?: string; // e.g., "{{status}} == 200" or "{{userId}} != ''"
  thenStepId?: string;
  elseStepId?: string;
  delayMs?: number;
  assertionTarget?: string; // status | body
  assertionExpected?: string;
  collectionId?: string;
  reportFormat?: 'json' | 'html' | 'csv';
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  environmentId?: string;
  steps: WorkflowStepConfig[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowStepExecutionLog {
  stepId: string;
  stepName: string;
  type: WorkflowStepType;
  status: 'passed' | 'failed' | 'skipped';
  startedAt: number;
  durationMs: number;
  outputSummary?: string;
  errorMessage?: string;
  responseSnapshot?: Pick<ApiResponse, 'status' | 'statusText' | 'timeMs'>;
}

export interface WorkflowExecutionReport {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'passed' | 'failed' | 'stopped';
  startedAt: number;
  completedAt: number;
  durationMs: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  logs: WorkflowStepExecutionLog[];
}

// ===================== 10. CLI Configurations & 11. Analytics =====================

export interface CliConfiguration {
  id: string;
  name: string;
  subcommand:
    | 'run collection'
    | 'run tests'
    | 'run contract-tests'
    | 'run security-audit'
    | 'run performance-test'
    | 'validate openapi'
    | 'generate report'
    | 'export collection';
  projectPath: string;
  collectionName?: string;
  environmentName?: string;
  suiteName?: string;
  outputFormat: 'terminal' | 'json' | 'junit-xml';
  timeoutSeconds: number;
  verbose: boolean;
  updatedAt: number;
}

export interface AnalyticsSnapshot {
  id: string;
  generatedAt: number;
  totalRequestsExecuted: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  apiAvailabilityPercent: number;
  testPassRatePercent: number;
  contractPassRatePercent: number;
  openSecurityFindings: number;
  performanceRunsCount: number;
  workflowRunsCount: number;
}

export interface UnifiedReportItem {
  id: string;
  kind: 'test' | 'contract' | 'performance' | 'security' | 'monitoring' | 'workflow';
  title: string;
  status: string;
  timestamp: number;
  summary: string;
  rawPayload: unknown;
}
