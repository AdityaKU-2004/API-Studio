import { describe, it, expect } from 'vitest';
import {
  CLI_EXIT_CODES_DOC,
  generateCiPipelineConfig,
  generateJunitXmlReport,
} from '../../services/cicd/pipelineGenerator';
import { buildCliCommandLine } from '../../services/cli/cliConfigService';
import {
  computeMonitorSummary,
  evaluateAlertTransition,
  evaluateMonitorStatus,
  executeMonitorCheck,
} from '../../services/monitoring/monitoringService';
import {
  AlertConfig,
  CiPipelineOptions,
  CliConfiguration,
  MonitorCheckResult,
  MonitorConfig,
} from '../../types';

describe('Phase 9: CI/CD Pipelines, Headless CLI Builder & Monitoring Probes', () => {
  it('generates GitHub, GitLab, Jenkins, and Shell CI configs with secret placeholders only', () => {
    const baseOpts: CiPipelineOptions = {
      provider: 'github-actions',
      template: 'full-regression',
      projectName: 'Core Payments',
      collectionName: 'Payments Suite',
      environmentName: 'Staging',
      specPath: 'openapi.yaml',
      runContractTests: true,
      runSecurityChecks: true,
      validateOpenApi: true,
      reportFormat: 'junit-xml',
      timeoutSeconds: 180,
    };

    const gh = generateCiPipelineConfig(baseOpts);
    expect(gh.filename).toBe('.github/workflows/api-studio-ci.yml');
    expect(gh.content).toContain('${{ secrets.API_STUDIO_TOKEN }}');
    expect(gh.content).toContain('api-studio');

    const gl = generateCiPipelineConfig({ ...baseOpts, provider: 'gitlab-ci' });
    expect(gl.filename).toBe('.gitlab-ci.yml');
    expect(gl.content).toContain('junit: api-studio-report.xml');

    const jk = generateCiPipelineConfig({ ...baseOpts, provider: 'jenkins' });
    expect(jk.filename).toBe('Jenkinsfile');
    expect(jk.content).toContain("credentials('api-studio-token')");

    const sh = generateCiPipelineConfig({ ...baseOpts, provider: 'shell', template: 'smoke-tests' });
    expect(sh.filename).toBe('run-api-checks.sh');
    expect(sh.content).toContain('API_STUDIO_TOKEN');
    expect(CLI_EXIT_CODES_DOC.map((c) => c.code)).toEqual([0, 1, 2, 3]);
  });

  it('escapes and formats JUnit XML and builds headless CLI commands cleanly', () => {
    const xml = generateJunitXmlReport({
      suiteName: 'Billing <API> Gate',
      cases: [
        { name: 'GET /health', classname: 'smoke', durationMs: 120 },
        { name: 'POST /charge', classname: 'payments', durationMs: 450, failureMessage: 'HTTP "500" <boom>' },
      ],
    });
    expect(xml).toContain('tests="2" failures="1"');
    expect(xml).toContain('Billing &lt;API&gt; Gate');
    expect(xml).toContain('HTTP &quot;500&quot; &lt;boom&gt;');

    const cliCfg: CliConfiguration = {
      id: 'cli-1',
      name: 'Smoke Gate',
      subcommand: 'run collection',
      projectPath: './workspace.db',
      collectionName: 'Auth',
      outputFormat: 'junit-xml',
      timeoutSeconds: 90,
      verbose: true,
      updatedAt: 1,
    };
    const cmd = buildCliCommandLine(cliCfg);
    expect(cmd).toContain('api-studio --format junit-xml run collection');
    expect(cmd).toContain('--collection "Auth"');
    expect(cmd).toContain('--timeout 90');
  });

  it('evaluates monitor statuses, computes uptime summaries, and dispatches failure/recovery/latency alerts', async () => {
    expect(evaluateMonitorStatus(false, 50, 200)).toBe('unavailable');
    expect(evaluateMonitorStatus(true, 350, 200)).toBe('degraded');
    expect(evaluateMonitorStatus(true, 90, 200)).toBe('healthy');

    const monitor: MonitorConfig = {
      id: 'mon-1',
      name: 'Orders Health',
      protocol: 'tcp',
      endpoint: '127.0.0.1:5432',
      method: 'GET',
      headers: {},
      expectedStatuses: [200],
      timeoutMs: 3000,
      intervalSeconds: 60,
      degradedLatencyMs: 250,
      enabled: true,
      paused: false,
      createdAt: 1,
      updatedAt: 1,
    };

    // Browser mode gracefully reports TCP probe limitation
    const tcpResult = await executeMonitorCheck(monitor, {});
    expect(tcpResult.success).toBe(false);
    expect(tcpResult.errorMessage).toContain('Desktop runtime');

    const results: MonitorCheckResult[] = [
      { id: 'c1', monitorId: 'mon-1', timestamp: 1000, status: 'healthy', responseTimeMs: 40, success: true },
      { id: 'c2', monitorId: 'mon-1', timestamp: 2000, status: 'unavailable', responseTimeMs: 100, success: false, errorMessage: '502' },
      { id: 'c3', monitorId: 'mon-1', timestamp: 3000, status: 'unavailable', responseTimeMs: 120, success: false, errorMessage: '502' },
    ];
    const summary = computeMonitorSummary('mon-1', results);
    expect(summary.totalChecks).toBe(3);
    expect(summary.failureCount).toBe(2);
    expect(summary.consecutiveFailures).toBe(2);
    expect(summary.availabilityPercent).toBeCloseTo(33.33, 2);

    const alertCfg: AlertConfig = {
      id: 'alt-1',
      monitorId: 'mon-1',
      name: 'Pager',
      desktopNotification: true,
      inAppNotification: true,
      webhookEnabled: false,
      alertOnFailure: true,
      alertOnRecovery: true,
      latencyThresholdMs: 200,
      updatedAt: 1,
    };

    const failAlert = evaluateAlertTransition({
      monitor,
      previousStatus: 'healthy',
      result: results[1],
      alertConfig: alertCfg,
    });
    expect(failAlert?.type).toBe('failure');

    const recoveryAlert = evaluateAlertTransition({
      monitor,
      previousStatus: 'unavailable',
      result: { id: 'c4', monitorId: 'mon-1', timestamp: 4000, status: 'healthy', responseTimeMs: 50, success: true },
      alertConfig: alertCfg,
    });
    expect(recoveryAlert?.type).toBe('recovery');

    const latencyAlert = evaluateAlertTransition({
      monitor,
      previousStatus: 'healthy',
      result: { id: 'c5', monitorId: 'mon-1', timestamp: 5000, status: 'degraded', responseTimeMs: 320, success: true },
      alertConfig: alertCfg,
    });
    expect(latencyAlert?.type).toBe('latency');
  });
});
