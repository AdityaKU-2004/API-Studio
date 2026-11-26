import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../database/database';
import { executeWorkflow } from '../../services/workflows/workflowEngine';
import {
  exportQueryResultAsCsv,
  isDestructiveSql,
  isReadOnlySql,
} from '../../services/database/dbToolsService';
import {
  buildDependencyGraph,
  exportDependencyGraphAsMermaid,
} from '../../services/dependency/dependencyAnalyzer';
import {
  buildAnalyticsSnapshot,
  collectUnifiedReports,
  exportUnifiedReport,
} from '../../services/analytics/analyticsService';
import { createDefaultRequest } from '../../stores/requestStore';
import { httpClient } from '../../services/http/httpClient';
import {
  AutomationWorkflow,
  CollectionItem,
  Environment,
  OpenApiSpecRecord,
} from '../../types';

describe('Phase 9: Workflows, DB Guards, Dependencies, Analytics & Dexie v5 Schema', () => {
  beforeEach(async () => {
    await db.open();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes all 16 Phase 9 Dexie v5 stores cleanly', async () => {
    const tableNames = db.tables.map((t) => t.name);
    for (const expected of [
      'performanceTestConfigs',
      'performanceTestRuns',
      'performanceMetrics',
      'securityAuditConfigs',
      'securityFindings',
      'monitoringConfigs',
      'monitoringResults',
      'alertConfigs',
      'databaseConnectionProfiles',
      'queryHistory',
      'environmentValidationResults',
      'dependencyGraphData',
      'automationWorkflows',
      'workflowExecutions',
      'cliConfigurations',
      'analyticsSnapshots',
    ]) {
      expect(tableNames).toContain(expected);
    }
  });

  it('executes sequential automation workflows with JSONPath extraction, branching, and ephemeral secret scrubbing', async () => {
    vi.spyOn(httpClient, 'execute').mockResolvedValue({
      id: 'resp-wf-1',
      requestId: 'req-login',
      url: 'https://api.example.com/auth/login',
      method: 'POST',
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: { 'content-type': 'application/json' },
      body: '{"data":{"sessionToken":"jwt-ephemeral-999","role":"admin"}}',
      rawBody: '{"data":{"sessionToken":"jwt-ephemeral-999","role":"admin"}}',
      contentType: 'application/json',
      contentTypeCategory: 'json',
      size: 62,
      sizeBytes: 62,
      timeMs: 14,
      timing: { startTime: 0, endTime: 14, duration: 14, prepareMs: 1, waitingMs: 12, downloadMs: 1 },
      receivedAt: new Date().toISOString(),
      timestamp: Date.now(),
      cookies: [],
      tests: [],
    });

    const workflow: AutomationWorkflow = {
      id: 'wf-1',
      name: 'Auth Flow',
      description: 'Login, extract secret token, branch, assert',
      steps: [
        {
          id: 's1',
          name: 'Set Base URL',
          type: 'set-variable',
          enabled: true,
          timeoutMs: 1000,
          retryCount: 0,
          continueOnError: false,
          variableKey: 'baseUrl',
          variableValue: 'https://api.example.com',
        },
        {
          id: 's2',
          name: 'Login Request',
          type: 'http-request',
          enabled: true,
          timeoutMs: 5000,
          retryCount: 0,
          continueOnError: false,
          method: 'POST',
          url: '{{baseUrl}}/auth/login',
        },
        {
          id: 's3',
          name: 'Extract Ephemeral Token',
          type: 'extract-response',
          enabled: true,
          timeoutMs: 1000,
          retryCount: 0,
          continueOnError: false,
          jsonPath: '$.data.sessionToken',
          variableKey: 'authToken',
          isEphemeralSecret: true,
        },
        {
          id: 's4',
          name: 'Branch Check',
          type: 'condition',
          enabled: true,
          timeoutMs: 1000,
          retryCount: 0,
          continueOnError: false,
          conditionExpression: '{{status}} == 200',
          thenStepId: 's6',
          elseStepId: 's5',
        },
        {
          id: 's5',
          name: 'Should Be Skipped By Branch',
          type: 'delay',
          enabled: true,
          timeoutMs: 1000,
          retryCount: 0,
          continueOnError: false,
          delayMs: 10,
        },
        {
          id: 's6',
          name: 'Verify 200 Status',
          type: 'assertion',
          enabled: true,
          timeoutMs: 1000,
          retryCount: 0,
          continueOnError: false,
          assertionTarget: 'status',
          assertionExpected: '200',
        },
        {
          id: 's7',
          name: 'Summary Report Step',
          type: 'generate-report',
          enabled: true,
          timeoutMs: 1000,
          retryCount: 0,
          continueOnError: false,
          reportFormat: 'json',
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };

    const report = await executeWorkflow({
      workflow,
      initialVariables: {},
      savedRequests: [],
    });

    expect(report.status).toBe('passed');
    expect(report.failedSteps).toBe(0);
    expect(report.logs.some((l) => l.stepId === 's5')).toBe(false);
    expect(JSON.stringify(report.logs)).not.toContain('jwt-ephemeral-999');

    // Cancellation path
    const ac = new AbortController();
    ac.abort();
    const cancelled = await executeWorkflow({
      workflow,
      initialVariables: {},
      savedRequests: [],
      signal: ac.signal,
    });
    expect(cancelled.status).toBe('stopped');
  });

  it('enforces read-only/destructive SQL guards and exports CSV results cleanly', () => {
    expect(isReadOnlySql('SELECT * FROM users LIMIT 10;')).toBe(true);
    expect(isReadOnlySql('  -- comment\nWITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(true);
    expect(isReadOnlySql('INSERT INTO users (name) VALUES ("a")')).toBe(false);

    expect(isDestructiveSql('DROP TABLE users;')).toBe(true);
    expect(isDestructiveSql('DELETE FROM users;')).toBe(true);
    expect(isDestructiveSql('DELETE FROM users WHERE id = 5;')).toBe(false);
    expect(isDestructiveSql('UPDATE users SET active = 0;')).toBe(true);
    expect(isDestructiveSql('UPDATE users SET active = 0 WHERE id = 5;')).toBe(false);

    const csv = exportQueryResultAsCsv({
      columns: ['id', 'note'],
      rows: [{ id: 1, note: 'hello, "world"' }],
      rowCount: 1,
      truncated: false,
      durationMs: 3,
      warnings: [],
    });
    expect(csv).toBe('id,note\n1,"hello, ""world"""');
  });

  it('constructs explicit and inferred static dependency graphs and exports Mermaid', () => {
    const collections: CollectionItem[] = [
      { id: 'col-1', name: 'Orders', type: 'collection', children: [] },
    ];
    const req = {
      ...createDefaultRequest('Create Order', 'POST'),
      url: 'https://orders.api.test/v1/orders',
      collectionId: 'col-1',
      rawBody: '{"token":"{{api_token}}"}',
      auth: { type: 'bearer' as const, bearer: { token: '{{api_token}}' } },
      testScript: 'pm.environment.set("order_id", "123");',
    };
    const specs: OpenApiSpecRecord[] = [
      {
        id: 'sp-1',
        projectId: 'proj-1',
        workspaceId: 'ws-1',
        name: 'Orders API',
        version: '1.0.0',
        format: 'yaml',
        sourceType: 'manual',
        content: `openapi: 3.0.0
info:
  title: Orders
  version: 1.0.0
servers:
  - url: https://orders.api.test
paths:
  /orders:
    get:
      summary: List orders
      responses:
        '200':
          description: OK
`,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const envs: Environment[] = [
      {
        id: 'env-1',
        name: 'Prod',
        variables: [
          { id: 'v1', key: 'api_token', initialValue: '', currentValue: '', description: '', isSecret: true, enabled: true },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const graph = buildDependencyGraph({
      collections,
      requests: [req],
      specs,
      environments: envs,
    });

    expect(graph.edges.some((e) => e.certainty === 'explicit')).toBe(true);
    expect(graph.edges.some((e) => e.certainty === 'inferred')).toBe(true);
    expect(graph.nodes.some((n) => n.label === '{{order_id}}')).toBe(true);

    const mermaid = exportDependencyGraphAsMermaid(graph);
    expect(mermaid).toContain('flowchart LR');
    expect(mermaid).toContain('inferred');
  });

  it('aggregates unified analytics snapshot, unified reports, and scrubbed exports', () => {
    const snapshot = buildAnalyticsSnapshot({
      history: [
        {
          id: 'h1',
          url: 'https://api.test/ok',
          method: 'GET',
          status: 200,
          statusText: 'OK',
          timeMs: 100,
          sizeBytes: 50,
          timestamp: 1000,
          request: createDefaultRequest('OK', 'GET'),
        },
        {
          id: 'h2',
          url: 'https://api.test/fail',
          method: 'GET',
          status: 500,
          statusText: 'Err',
          timeMs: 200,
          sizeBytes: 50,
          timestamp: 2000,
          request: createDefaultRequest('Fail', 'GET'),
        },
      ],
      testReports: [
        {
          id: 'tr1',
          name: 'Core Suite Run',
          sourceType: 'collection',
          sourceId: 'c1',
          sourceName: 'Core',
          environmentId: null,
          environmentName: 'None',
          status: 'failed',
          startedAt: 1000,
          finishedAt: 1100,
          summary: {
            totalRequests: 1,
            passedRequests: 1,
            failedRequests: 0,
            totalAssertions: 4,
            passedAssertions: 3,
            failedAssertions: 1,
            skippedAssertions: 0,
            passRate: 75,
            averageResponseTimeMs: 100,
            minResponseTimeMs: 100,
            maxResponseTimeMs: 100,
            totalDurationMs: 100,
            iterations: 1,
          },
          statusDistribution: [{ bucket: '2xx', count: 1 }],
          results: [],
          createdAt: 1000,
        },
      ],
      contractReports: [],
      performanceRuns: [],
      securityFindings: [
        {
          id: 'sf1',
          auditId: 'a1',
          title: 'Secret Leak',
          severity: 'high',
          category: 'info-exposure',
          affectedEndpoint: '/debug',
          evidence: 'Authorization: Bearer leaked-secret-token-xyz',
          explanation: 'Leaked',
          remediation: 'Fix',
          status: 'open',
          detectedAt: 3000,
        },
      ],
      monitoringResults: [
        { id: 'm1', monitorId: 'mon1', timestamp: 4000, status: 'healthy', responseTimeMs: 40, success: true },
      ],
      workflowExecutions: [],
    });

    expect(snapshot.totalRequestsExecuted).toBe(2);
    expect(snapshot.avgResponseTimeMs).toBe(150);
    expect(snapshot.testPassRatePercent).toBe(75);
    expect(snapshot.openSecurityFindings).toBe(1);
    expect(snapshot.apiAvailabilityPercent).toBe(100);

    const unified = collectUnifiedReports({
      testReports: [],
      contractReports: [],
      performanceRuns: [],
      securityFindings: [
        {
          id: 'sf1',
          auditId: 'a1',
          title: 'Secret Leak',
          severity: 'high',
          category: 'info-exposure',
          affectedEndpoint: '/debug',
          evidence: 'Authorization: Bearer leaked-secret-token-xyz',
          explanation: 'Leaked',
          remediation: 'Fix',
          status: 'open',
          detectedAt: 3000,
        },
      ],
      monitoringResults: [],
      workflowExecutions: [],
    });

    expect(unified).toHaveLength(1);
    const jsonOut = exportUnifiedReport(unified[0], 'json');
    expect(jsonOut).not.toContain('leaked-secret-token-xyz');
    expect(exportUnifiedReport(unified[0], 'junit-xml')).toContain('<failure');
    expect(exportUnifiedReport(unified[0], 'csv')).toContain('findings-open');
    expect(exportUnifiedReport(unified[0], 'html')).toContain('Security Audit Findings Summary');
  });
});
