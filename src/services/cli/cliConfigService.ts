import { CliConfiguration } from '../../types';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from '../desktop/tauriBridge';

export const CLI_EXIT_CODES: Array<{ code: number; meaning: string }> = [
  { code: 0, meaning: 'Success: all requested checks, tests, or audits passed' },
  { code: 1, meaning: 'Failure: one or more tests, contract assertions, or audit gates failed' },
  { code: 2, meaning: 'Configuration Error: invalid arguments, unknown collection/spec, or unsafe path' },
  { code: 3, meaning: 'Execution Error: network failure, timeout, or database error' },
];

export function buildCliCommandLine(config: CliConfiguration): string {
  const parts = ['api-studio', `--format ${config.outputFormat}`];
  const dbPath = config.projectPath.trim() || './api-studio.db';

  switch (config.subcommand) {
    case 'run collection':
      parts.push(`run collection --db "${dbPath}"`);
      if (config.collectionName?.trim()) parts.push(`--collection "${config.collectionName.trim()}"`);
      parts.push(`--timeout ${config.timeoutSeconds}`);
      break;
    case 'run tests':
      parts.push(`run collection --db "${dbPath}"`);
      if (config.suiteName?.trim()) parts.push(`--collection "${config.suiteName.trim()}"`);
      parts.push(`--timeout ${config.timeoutSeconds}`);
      break;
    case 'run contract-tests':
      parts.push(`validate --spec "${dbPath}"`);
      break;
    case 'run security-audit':
      parts.push(`run security-audit --url "${dbPath}"`);
      break;
    case 'run performance-test':
      parts.push(`run performance-test --url "${dbPath}" --vus 5 --duration 10`);
      break;
    case 'validate openapi':
      parts.push(`validate --spec "${dbPath}"`);
      break;
    case 'generate report':
      parts.push(`report --db "${dbPath}"`);
      break;
    case 'export collection':
      parts.push(`report --db "${dbPath}"`);
      break;
  }

  return parts.join(' ');
}

export async function runDesktopCliPreview(params: {
  subcommand: CliConfiguration['subcommand'];
  targetUrl?: string;
  specPath?: string;
}): Promise<{
  exitCode: number;
  status: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  details: string[];
}> {
  if (!isTauriRuntime()) {
    return {
      exitCode: 2,
      status: 'browser-preview',
      total: 0,
      passed: 0,
      failed: 0,
      durationMs: 0,
      details: [
        'Install or build the native desktop binary (cargo build --bin api-studio) to run headless CLI suites in CI/CD.',
      ],
    };
  }
  return invokeDesktop('cli_execute_preview', {
    subcommand: params.subcommand,
    targetUrl: params.targetUrl ?? null,
    specPath: params.specPath ?? null,
  });
}
