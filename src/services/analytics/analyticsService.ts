import {
  AnalyticsSnapshot,
  ContractTestReport,
  HistoryItem,
  MonitorCheckResult,
  PerformanceTestRun,
  SecurityFinding,
  TestReport,
  UnifiedReportItem,
  WorkflowExecutionReport,
} from '../../types';
import { scrubSensitiveText } from '../security/securityAuditor';
import { generateJunitXmlReport } from '../cicd/pipelineGenerator';

export function buildAnalyticsSnapshot(params: {
  history: HistoryItem[];
  testReports: TestReport[];
  contractReports: ContractTestReport[];
  performanceRuns: PerformanceTestRun[];
  securityFindings: SecurityFinding[];
  monitoringResults: MonitorCheckResult[];
  workflowExecutions: WorkflowExecutionReport[];
}): AnalyticsSnapshot {
  const totalRequestsExecuted = params.history.length;
  const successfulRequests = params.history.filter(
    (h) => h.status >= 200 && h.status < 400
  ).length;
  const failedRequests = totalRequestsExecuted - successfulRequests;

  const avgResponseTimeMs =
    totalRequestsExecuted > 0
      ? Number(
          (
            params.history.reduce((acc, h) => acc + (h.timeMs || 0), 0) /
            totalRequestsExecuted
          ).toFixed(1)
        )
      : 0;

  const monTotal = params.monitoringResults.length;
  const monOk = params.monitoringResults.filter((m) => m.success).length;
  const apiAvailabilityPercent =
    monTotal > 0 ? Number(((monOk / monTotal) * 100).toFixed(2)) : 100;

  const totalTests = params.testReports.reduce((acc, r) => acc + (r.summary?.totalAssertions || 0), 0);
  const passedTests = params.testReports.reduce((acc, r) => acc + (r.summary?.passedAssertions || 0), 0);
  const testPassRatePercent =
    totalTests > 0 ? Number(((passedTests / totalTests) * 100).toFixed(1)) : 100;

  const totalContracts = params.contractReports.reduce(
    (acc, r) => acc + (r.totalEndpoints || 0),
    0
  );
  const passedContracts = params.contractReports.reduce(
    (acc, r) => acc + (r.passedCount || 0),
    0
  );
  const contractPassRatePercent =
    totalContracts > 0 ? Number(((passedContracts / totalContracts) * 100).toFixed(1)) : 100;

  const openSecurityFindings = params.securityFindings.filter(
    (f) => f.status === 'open'
  ).length;

  return {
    id: `ana-${Date.now()}`,
    generatedAt: Date.now(),
    totalRequestsExecuted,
    successfulRequests,
    failedRequests,
    avgResponseTimeMs,
    apiAvailabilityPercent,
    testPassRatePercent,
    contractPassRatePercent,
    openSecurityFindings,
    performanceRunsCount: params.performanceRuns.length,
    workflowRunsCount: params.workflowExecutions.length,
  };
}

export function collectUnifiedReports(params: {
  testReports: TestReport[];
  contractReports: ContractTestReport[];
  performanceRuns: PerformanceTestRun[];
  securityFindings: SecurityFinding[];
  monitoringResults: MonitorCheckResult[];
  workflowExecutions: WorkflowExecutionReport[];
}): UnifiedReportItem[] {
  const items: UnifiedReportItem[] = [];

  for (const tr of params.testReports) {
    items.push({
      id: `utr-${tr.id}`,
      kind: 'test',
      title: `Test Run: ${tr.sourceName || tr.name}`,
      status: tr.summary.failedAssertions === 0 ? 'passed' : 'failed',
      timestamp: tr.startedAt,
      summary: `${tr.summary.passedAssertions}/${tr.summary.totalAssertions} assertions passed (${tr.summary.totalDurationMs}ms)`,
      rawPayload: tr,
    });
  }

  for (const cr of params.contractReports) {
    items.push({
      id: `ucr-${cr.id}`,
      kind: 'contract',
      title: `Contract Report: ${cr.specName}`,
      status: cr.failedCount === 0 ? 'passed' : 'failed',
      timestamp: cr.startedAt,
      summary: `${cr.passedCount}/${cr.totalEndpoints} endpoints passed · ${cr.baseUrl}`,
      rawPayload: cr,
    });
  }

  for (const pr of params.performanceRuns) {
    items.push({
      id: `upr-${pr.id}`,
      kind: 'performance',
      title: `Perf (${pr.configSnapshot.mode}): ${pr.configSnapshot.name}`,
      status: pr.status,
      timestamp: pr.startedAt,
      summary: `${pr.summary.totalRequests} reqs · ${pr.summary.requestsPerSecond} RPS · P95 ${pr.summary.p95ResponseTimeMs}ms`,
      rawPayload: pr,
    });
  }

  if (params.securityFindings.length > 0) {
    const openCount = params.securityFindings.filter((f) => f.status === 'open').length;
    const latest = Math.max(...params.securityFindings.map((f) => f.detectedAt));
    items.push({
      id: `usec-${latest}`,
      kind: 'security',
      title: 'Security Audit Findings Summary',
      status: openCount === 0 ? 'clean' : 'findings-open',
      timestamp: latest,
      summary: `${params.securityFindings.length} total findings (${openCount} open)`,
      rawPayload: params.securityFindings,
    });
  }

  if (params.monitoringResults.length > 0) {
    const latest = Math.max(...params.monitoringResults.map((m) => m.timestamp));
    const ok = params.monitoringResults.filter((m) => m.success).length;
    items.push({
      id: `umon-${latest}`,
      kind: 'monitoring',
      title: 'API Monitoring Health Log',
      status: ok === params.monitoringResults.length ? 'healthy' : 'degraded',
      timestamp: latest,
      summary: `${ok}/${params.monitoringResults.length} checks succeeded`,
      rawPayload: params.monitoringResults,
    });
  }

  for (const wf of params.workflowExecutions) {
    items.push({
      id: `uwf-${wf.id}`,
      kind: 'workflow',
      title: `Workflow: ${wf.workflowName}`,
      status: wf.status,
      timestamp: wf.startedAt,
      summary: `${wf.completedSteps} passed · ${wf.failedSteps} failed · ${wf.durationMs}ms`,
      rawPayload: wf,
    });
  }

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export function exportUnifiedReport(
  report: UnifiedReportItem,
  format: 'json' | 'csv' | 'html' | 'junit-xml'
): string {
  const safeJson = scrubSensitiveText(JSON.stringify(report.rawPayload, null, 2));
  if (format === 'json') {
    return JSON.stringify(
      {
        id: report.id,
        kind: report.kind,
        title: report.title,
        status: report.status,
        timestamp: report.timestamp,
        summary: report.summary,
        payload: JSON.parse(safeJson),
      },
      null,
      2
    );
  }
  if (format === 'csv') {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return `id,kind,title,status,timestamp,summary\n${esc(report.id)},${esc(
      report.kind
    )},${esc(report.title)},${esc(report.status)},${report.timestamp},${esc(report.summary)}`;
  }
  if (format === 'junit-xml') {
    const failed = report.status === 'failed' || report.status === 'findings-open';
    return generateJunitXmlReport({
      suiteName: report.title,
      cases: [
        {
          name: report.title,
          classname: `api-studio.${report.kind}`,
          durationMs: 0,
          failureMessage: failed ? report.summary : undefined,
        },
      ],
    });
  }
  const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escHtml(report.title)}</title></head>
<body style="font-family:system-ui,sans-serif;margin:2rem">
  <h1>${escHtml(report.title)}</h1>
  <p><strong>Kind:</strong> ${escHtml(report.kind)} · <strong>Status:</strong> ${escHtml(report.status)}</p>
  <p>${escHtml(report.summary)}</p>
  <pre style="background:#f8fafc;padding:1rem;border:1px solid #cbd5e1;overflow:auto">${escHtml(safeJson)}</pre>
</body>
</html>`;
}
