import {
  EnvironmentVariable,
  ReportSummaryMetrics,
  RunnerProgressState,
  RunnerRequestExecutionResult,
  StatusCodeDistributionItem,
  TestReport,
} from '../../types';
import { testReportRepository } from '../../repositories/testReportRepository';

function collectSecretValues(secretSources: Array<EnvironmentVariable[] | undefined>): string[] {
  const set = new Set<string>();
  for (const list of secretSources) {
    if (!list) continue;
    for (const v of list) {
      if ((v.isSecret || v.secret) && (v.currentValue || v.initialValue)) {
        const val = v.currentValue || v.initialValue;
        if (val.length >= 2) set.add(val);
      }
    }
  }
  return Array.from(set);
}

function maskSecrets(text: string | undefined, secrets: string[]): string {
  if (!text) return '';
  let out = text;
  for (const s of secrets) {
    out = out.split(s).join('••••••••');
  }
  return out;
}

function sanitizeResults(
  results: RunnerRequestExecutionResult[],
  secrets: string[]
): RunnerRequestExecutionResult[] {
  if (secrets.length === 0) return results;
  return results.map((r) => ({
    ...r,
    resolvedUrl: maskSecrets(r.resolvedUrl, secrets),
    failedReason: r.failedReason ? maskSecrets(r.failedReason, secrets) : undefined,
    consoleLogs: r.consoleLogs.map((l) => ({
      ...l,
      message: maskSecrets(l.message, secrets),
    })),
    tests: r.tests.map((t) => ({
      ...t,
      error: t.error ? maskSecrets(t.error, secrets) : undefined,
      message: t.message ? maskSecrets(t.message, secrets) : undefined,
    })),
  }));
}

export function buildTestReport(params: {
  name: string;
  sourceType: TestReport['sourceType'];
  sourceId?: string;
  sourceName: string;
  environmentId: string | null;
  environmentName: string;
  progress: RunnerProgressState;
  results: RunnerRequestExecutionResult[];
  secretSources?: Array<EnvironmentVariable[] | undefined>;
}): TestReport {
  const secrets = collectSecretValues(params.secretSources || []);
  const cleanResults = sanitizeResults(params.results, secrets);

  const totalRequests = cleanResults.length;
  const passedRequests = cleanResults.filter((r) => r.passed).length;
  const failedRequests = totalRequests - passedRequests;

  let passedAssertions = 0;
  let failedAssertions = 0;
  let skippedAssertions = 0;
  const times: number[] = [];

  const bucketCounts = new Map<string, number>([
    ['2xx', 0],
    ['3xx', 0],
    ['4xx', 0],
    ['5xx', 0],
    ['Error', 0],
  ]);

  for (const r of cleanResults) {
    times.push(r.responseTimeMs);
    for (const t of r.tests) {
      if (t.status === 'skipped') skippedAssertions += 1;
      else if (t.status === 'failed' || !t.passed) failedAssertions += 1;
      else passedAssertions += 1;
    }

    if (r.status >= 200 && r.status < 300) bucketCounts.set('2xx', (bucketCounts.get('2xx') || 0) + 1);
    else if (r.status >= 300 && r.status < 400) bucketCounts.set('3xx', (bucketCounts.get('3xx') || 0) + 1);
    else if (r.status >= 400 && r.status < 500) bucketCounts.set('4xx', (bucketCounts.get('4xx') || 0) + 1);
    else if (r.status >= 500 && r.status < 600) bucketCounts.set('5xx', (bucketCounts.get('5xx') || 0) + 1);
    else bucketCounts.set('Error', (bucketCounts.get('Error') || 0) + 1);
  }

  const totalAssertions = passedAssertions + failedAssertions + skippedAssertions;
  const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const minTime = times.length > 0 ? Math.min(...times) : 0;
  const maxTime = times.length > 0 ? Math.max(...times) : 0;

  const summary: ReportSummaryMetrics = {
    totalRequests,
    passedRequests,
    failedRequests,
    totalAssertions,
    passedAssertions,
    failedAssertions,
    skippedAssertions,
    passRate: totalRequests > 0 ? Math.round((passedRequests / totalRequests) * 100) : 100,
    averageResponseTimeMs: avgTime,
    minResponseTimeMs: minTime,
    maxResponseTimeMs: maxTime,
    totalDurationMs: params.progress.elapsedMs,
    iterations: params.progress.totalIterations,
  };

  const statusDistribution: StatusCodeDistributionItem[] = Array.from(bucketCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([bucket, count]) => ({ bucket, count }));

  const finalStatus: TestReport['status'] =
    params.progress.status === 'stopped'
      ? 'stopped'
      : failedRequests === 0 && failedAssertions === 0
      ? 'passed'
      : 'failed';

  const now = Date.now();
  return {
    id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
    name: params.name,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceName: params.sourceName,
    environmentId: params.environmentId,
    environmentName: params.environmentName,
    status: finalStatus,
    startedAt: params.progress.startedAt,
    finishedAt: params.progress.finishedAt || now,
    summary,
    statusDistribution,
    results: cleanResults,
    createdAt: now,
  };
}

export async function saveTestReport(report: TestReport, retentionLimit = 50): Promise<TestReport> {
  await testReportRepository.save(report, retentionLimit);
  return report;
}

export function exportReportAsJson(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}

function escapeCsvCell(val: string | number | boolean | undefined): string {
  const s = val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportReportAsCsv(report: TestReport): string {
  const headers = [
    'Iteration',
    'Order',
    'Request Name',
    'Method',
    'URL',
    'Status Code',
    'Status Text',
    'Response Time (ms)',
    'Size (bytes)',
    'Result',
    'Passed Tests',
    'Failed Tests',
    'Failure Reason',
  ];

  const rows = report.results.map((r) => {
    const passed = r.tests.filter((t) => t.status !== 'failed' && t.status !== 'skipped' && t.passed).length;
    const failed = r.tests.filter((t) => t.status === 'failed' || !t.passed).length;
    return [
      r.iteration,
      r.order,
      r.requestName,
      r.method,
      r.resolvedUrl,
      r.status,
      r.statusText,
      r.responseTimeMs,
      r.sizeBytes,
      r.passed ? 'PASSED' : 'FAILED',
      passed,
      failed,
      r.failedReason || '',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportReportAsHtml(report: TestReport): string {
  const rowsHtml = report.results
    .map((r) => {
      const testItems = r.tests
        .map(
          (t) =>
            `<li style="margin:2px 0;color:${
              t.status === 'skipped' ? '#94a3b8' : t.passed ? '#34d399' : '#f87171'
            }">${t.status === 'skipped' ? 'SKIP' : t.passed ? 'PASS' : 'FAIL'} — ${escapeHtml(t.name)}${
              t.error ? ` <span style="color:#fca5a5">(${escapeHtml(t.error)})</span>` : ''
            }</li>`
        )
        .join('');

      return `
        <tr>
          <td>#${r.iteration}.${r.order}</td>
          <td><strong>${escapeHtml(r.method)}</strong> ${escapeHtml(r.requestName)}<br><small style="color:#94a3b8">${escapeHtml(r.resolvedUrl)}</small></td>
          <td>${r.status} ${escapeHtml(r.statusText)}</td>
          <td>${r.responseTimeMs} ms</td>
          <td style="color:${r.passed ? '#34d399' : '#f87171'};font-weight:600">${r.passed ? 'PASSED' : 'FAILED'}</td>
          <td><ul style="margin:0;padding-left:16px;font-size:12px">${testItems || '<li style="color:#64748b">No assertions</li>'}</ul></td>
        </tr>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>API Studio Test Report — ${escapeHtml(report.name)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e2e8f0; margin: 0; padding: 32px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  h1 { margin: 0 0 6px; font-size: 20px; }
  .meta { color: #8b949e; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
  .stat { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; }
  .stat-label { font-size: 11px; color: #8b949e; text-transform: uppercase; }
  .stat-val { font-size: 20px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #21262d; vertical-align: top; }
  th { color: #8b949e; font-size: 11px; text-transform: uppercase; background: #0d1117; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(report.name)}</h1>
    <div class="meta">Source: ${escapeHtml(report.sourceName)} (${escapeHtml(report.sourceType)}) | Environment: ${escapeHtml(report.environmentName)} | Executed: ${new Date(report.startedAt).toISOString()}</div>
    <div class="grid">
      <div class="stat"><div class="stat-label">Requests</div><div class="stat-val">${report.summary.passedRequests} / ${report.summary.totalRequests} Passed</div></div>
      <div class="stat"><div class="stat-label">Assertions</div><div class="stat-val">${report.summary.passedAssertions} / ${report.summary.totalAssertions} Passed</div></div>
      <div class="stat"><div class="stat-label">Pass Rate</div><div class="stat-val">${report.summary.passRate}%</div></div>
      <div class="stat"><div class="stat-label">Avg Latency</div><div class="stat-val">${report.summary.averageResponseTimeMs} ms</div></div>
    </div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <table>
      <thead>
        <tr><th>Run</th><th>Request</th><th>Status</th><th>Latency</th><th>Outcome</th><th>Assertions</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</body>
</html>`;
}
