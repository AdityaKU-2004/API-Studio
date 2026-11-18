import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { ApiStudioDatabase } from '../../database/database';
import { TestReportRepository } from '../../repositories/testReportRepository';
import { TestSuiteRepository } from '../../repositories/testSuiteRepository';
import {
  buildTestReport,
  exportReportAsCsv,
  exportReportAsHtml,
  exportReportAsJson,
} from '../../services/testing/testReportService';
import { RunnerProgressState, RunnerRequestExecutionResult } from '../../types';

function sampleRunData() {
  const progress: RunnerProgressState = {
    runId: 'run-test-1',
    status: 'completed',
    totalExecutions: 2,
    completedExecutions: 2,
    currentIteration: 1,
    totalIterations: 1,
    currentRequestIndex: 2,
    passedRequests: 1,
    failedRequests: 1,
    passedAssertions: 2,
    failedAssertions: 1,
    skippedAssertions: 0,
    elapsedMs: 320,
    startedAt: 1710000000000,
    finishedAt: 1710000000320,
    percentage: 100,
  };

  const results: RunnerRequestExecutionResult[] = [
    {
      id: 'res-1',
      iteration: 1,
      order: 1,
      requestId: 'req-1',
      requestName: 'Get Profile',
      method: 'GET',
      resolvedUrl: 'https://api.test/me?key=top-secret-api-key',
      status: 200,
      statusText: 'OK',
      responseTimeMs: 110,
      sizeBytes: 256,
      passed: true,
      tests: [
        { name: 'Status 200', passed: true, status: 'passed' },
        { name: 'Latency < 300', passed: true, status: 'passed' },
      ],
      assertions: [],
      consoleLogs: [
        { id: 'l1', level: 'log', message: 'token=top-secret-api-key', timestamp: 1710000000050, stage: 'post-response' },
      ],
      timestamp: 1710000000110,
    },
    {
      id: 'res-2',
      iteration: 1,
      order: 2,
      requestId: 'req-2',
      requestName: 'Create Order',
      method: 'POST',
      resolvedUrl: 'https://api.test/orders',
      status: 422,
      statusText: 'Unprocessable Entity',
      responseTimeMs: 210,
      sizeBytes: 120,
      passed: false,
      failedReason: 'Expected 201 but got 422',
      tests: [
        { name: 'Status 201', passed: false, status: 'failed', error: 'Expected 201 but got 422' },
      ],
      assertions: [],
      consoleLogs: [],
      timestamp: 1710000000320,
    },
  ];

  const secretSources = [
    [
      {
        id: 'sec-1',
        key: 'api_key',
        initialValue: 'top-secret-api-key',
        currentValue: 'top-secret-api-key',
        description: '',
        enabled: true,
        isSecret: true,
      },
    ],
  ];

  return { progress, results, secretSources };
}

describe('Phase 5: Test Reports, Persistence & Export', () => {
  let db: ApiStudioDatabase;
  let reportRepo: TestReportRepository;
  let suiteRepo: TestSuiteRepository;

  beforeEach(async () => {
    db = new ApiStudioDatabase(`ApiStudioPhase5Test_${Date.now()}_${Math.random()}`);
    await db.open();
    reportRepo = new TestReportRepository(db);
    suiteRepo = new TestSuiteRepository(db);
  });

  it('33. builds complete report summary, latency stats, status distribution, and masks secrets', () => {
    const { progress, results, secretSources } = sampleRunData();
    const report = buildTestReport({
      name: 'Smoke Suite Run',
      sourceType: 'suite',
      sourceName: 'Smoke Suite',
      environmentId: 'env-prod',
      environmentName: 'Production',
      progress,
      results,
      secretSources,
    });

    expect(report.status).toBe('failed');
    expect(report.summary.totalRequests).toBe(2);
    expect(report.summary.passedRequests).toBe(1);
    expect(report.summary.failedRequests).toBe(1);
    expect(report.summary.passRate).toBe(50);
    expect(report.summary.averageResponseTimeMs).toBe(160);
    expect(report.summary.minResponseTimeMs).toBe(110);
    expect(report.summary.maxResponseTimeMs).toBe(210);
    expect(report.statusDistribution).toEqual([
      { bucket: '2xx', count: 1 },
      { bucket: '4xx', count: 1 },
    ]);

    // Secret masked across resolvedUrl and consoleLogs
    expect(report.results[0].resolvedUrl).not.toContain('top-secret-api-key');
    expect(report.results[0].resolvedUrl).toContain('••••••••');
    expect(report.results[0].consoleLogs[0].message).not.toContain('top-secret-api-key');
  });

  it('34. persists reports and test suites in IndexedDB and enforces retention limit', async () => {
    const { progress, results } = sampleRunData();
    for (let i = 0; i < 4; i++) {
      const r = buildTestReport({
        name: `Run ${i}`,
        sourceType: 'collection',
        sourceName: 'Core API',
        environmentId: null,
        environmentName: 'None',
        progress,
        results,
      });
      r.id = `rpt-ret-${i}`;
      r.createdAt = 1000 + i;
      await reportRepo.save(r, 2);
    }

    const stored = await reportRepo.getAll();
    expect(stored).toHaveLength(2);
    expect(stored.map((r) => r.id)).toEqual(['rpt-ret-3', 'rpt-ret-2']);

    await suiteRepo.create({
      id: 'suite-1',
      name: 'Regression Suite',
      description: 'Core regression',
      requestIds: ['req-1'],
      environmentId: null,
      assertions: [],
      iterations: 1,
      delayMs: 0,
      failureMode: 'continue',
      timeoutMs: 5000,
      iterationData: [],
      createdAt: 1000,
      updatedAt: 1000,
    });
    const suites = await suiteRepo.getAll();
    expect(suites).toHaveLength(1);
    expect(suites[0].name).toBe('Regression Suite');
  });

  it('35. exports clean JSON report with zero secret leakage', () => {
    const { progress, results, secretSources } = sampleRunData();
    const report = buildTestReport({
      name: 'JSON Export Check',
      sourceType: 'collection',
      sourceName: 'Users',
      environmentId: null,
      environmentName: 'Dev',
      progress,
      results,
      secretSources,
    });

    const json = exportReportAsJson(report);
    expect(json).not.toContain('top-secret-api-key');
    const parsed = JSON.parse(json);
    expect(parsed.summary.totalRequests).toBe(2);
    expect(parsed.results).toHaveLength(2);
  });

  it('36. exports properly escaped CSV report', () => {
    const { progress, results, secretSources } = sampleRunData();
    const report = buildTestReport({
      name: 'CSV Export Check',
      sourceType: 'collection',
      sourceName: 'Users',
      environmentId: null,
      environmentName: 'Dev',
      progress,
      results,
      secretSources,
    });

    const csv = exportReportAsCsv(report);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Request Name,Method,URL,Status Code');
    expect(lines[1]).toContain('Get Profile,GET,');
    expect(lines[1]).toContain('PASSED');
    expect(lines[2]).toContain('Create Order,POST,');
    expect(lines[2]).toContain('FAILED');
  });

  it('37. exports standalone HTML report with escaped content and masked secrets', () => {
    const { progress, results, secretSources } = sampleRunData();
    const report = buildTestReport({
      name: 'HTML Report <Verify>',
      sourceType: 'suite',
      sourceName: 'Suite A',
      environmentId: null,
      environmentName: 'Staging',
      progress,
      results,
      secretSources,
    });

    const html = exportReportAsHtml(report);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('HTML Report &lt;Verify&gt;');
    expect(html).toContain('Get Profile');
    expect(html).toContain('Create Order');
    expect(html).not.toContain('top-secret-api-key');
  });
});
