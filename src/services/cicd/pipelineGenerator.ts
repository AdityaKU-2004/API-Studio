import { CiPipelineOptions } from '../../types';

export const CLI_EXIT_CODES_DOC = [
  { code: 0, label: 'All tests, contract checks, and audits passed' },
  { code: 1, label: 'Test, assertion, contract, or audit threshold failure' },
  { code: 2, label: 'Invalid CLI arguments or missing configuration' },
  { code: 3, label: 'Execution, network, or runtime database error' },
];

export function buildCliCommandsForTemplate(options: CiPipelineOptions): string[] {
  const cmds: string[] = [];
  const envArg = options.environmentName ? ` --env "${options.environmentName}"` : '';
  const fmtArg = `--format ${options.reportFormat === 'junit-xml' ? 'junit-xml' : options.reportFormat === 'json' ? 'json' : 'terminal'}`;

  if (options.template === 'smoke-tests') {
    cmds.push(`api-studio ${fmtArg} run collection --collection "${options.collectionName}"${envArg} --timeout ${options.timeoutSeconds}`);
    return cmds;
  }

  if (options.template === 'basic-tests') {
    cmds.push(`api-studio ${fmtArg} run collection --collection "${options.collectionName}"${envArg} --timeout ${options.timeoutSeconds}`);
  }

  if (options.template === 'contract-validation' || options.runContractTests) {
    if (options.specPath) {
      cmds.push(`api-studio ${fmtArg} validate --spec "${options.specPath}"`);
    }
    cmds.push(`api-studio ${fmtArg} run collection --collection "${options.collectionName}"${envArg} --timeout ${options.timeoutSeconds}`);
  }

  if (options.template === 'security-checks' || options.runSecurityChecks) {
    cmds.push(`api-studio ${fmtArg} run security-audit --url "$API_BASE_URL"`);
  }

  if (options.template === 'full-regression') {
    if (options.specPath && options.validateOpenApi) {
      cmds.push(`api-studio ${fmtArg} validate --spec "${options.specPath}"`);
    }
    cmds.push(`api-studio ${fmtArg} run collection --collection "${options.collectionName}"${envArg} --timeout ${options.timeoutSeconds}`);
    if (options.runSecurityChecks) {
      cmds.push(`api-studio ${fmtArg} run security-audit --url "$API_BASE_URL"`);
    }
  }

  if (cmds.length === 0) {
    cmds.push(`api-studio ${fmtArg} run collection --collection "${options.collectionName}"${envArg} --timeout ${options.timeoutSeconds}`);
  }
  return cmds;
}

export function generateCiPipelineConfig(options: CiPipelineOptions): {
  filename: string;
  language: 'yaml' | 'groovy' | 'shell';
  content: string;
} {
  const cmds = buildCliCommandsForTemplate(options);
  const artifactExt =
    options.reportFormat === 'junit-xml'
      ? 'xml'
      : options.reportFormat === 'html'
      ? 'html'
      : options.reportFormat === 'csv'
      ? 'csv'
      : 'json';

  if (options.provider === 'github-actions') {
    const runSteps = cmds.map((c) => `          ${c} > api-studio-report.${artifactExt}`).join('\n');
    return {
      filename: '.github/workflows/api-studio-ci.yml',
      language: 'yaml',
      content: `name: ${options.projectName} API Quality Gate

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  api-verification:
    runs-on: ubuntu-latest
    timeout-minutes: ${Math.max(5, Math.ceil(options.timeoutSeconds / 60) + 5)}
    env:
      API_BASE_URL: \${{ vars.API_BASE_URL }}
      API_STUDIO_TOKEN: \${{ secrets.API_STUDIO_TOKEN }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Execute API Studio CLI suite
        run: |
${runSteps}

      - name: Upload API Studio test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: api-studio-report
          path: api-studio-report.${artifactExt}
`,
    };
  }

  if (options.provider === 'gitlab-ci') {
    const scriptLines = cmds.map((c) => `    - ${c} > api-studio-report.${artifactExt}`).join('\n');
    const reportSection =
      options.reportFormat === 'junit-xml'
        ? `    reports:\n      junit: api-studio-report.xml`
        : `    paths:\n      - api-studio-report.${artifactExt}`;
    return {
      filename: '.gitlab-ci.yml',
      language: 'yaml',
      content: `stages:
  - verify

api_studio_verification:
  stage: verify
  variables:
    # Configure API_BASE_URL and protected secret API_STUDIO_TOKEN in GitLab CI/CD Settings
    API_ENV: "${options.environmentName}"
  script:
${scriptLines}
  artifacts:
    when: always
${reportSection}
`,
    };
  }

  if (options.provider === 'jenkins') {
    const shCmds = cmds.map((c) => `        sh '${c} > api-studio-report.${artifactExt}'`).join('\n');
    const postAction =
      options.reportFormat === 'junit-xml'
        ? `    always {\n      junit 'api-studio-report.xml'\n    }`
        : `    always {\n      archiveArtifacts artifacts: 'api-studio-report.${artifactExt}', allowEmptyArchive: true\n    }`;
    return {
      filename: 'Jenkinsfile',
      language: 'groovy',
      content: `pipeline {
  agent any
  options {
    timeout(time: ${Math.max(5, Math.ceil(options.timeoutSeconds / 60) + 5)}, unit: 'MINUTES')
  }
  environment {
    API_BASE_URL = credentials('api-base-url')
    API_STUDIO_TOKEN = credentials('api-studio-token')
  }
  stages {
    stage('API Verification') {
      steps {
${shCmds}
      }
    }
  }
  post {
${postAction}
  }
}
`,
    };
  }

  // Generic POSIX shell script
  const shellBody = cmds.map((c) => `${c} > "api-studio-report.${artifactExt}"`).join('\n');
  return {
    filename: 'run-api-checks.sh',
    language: 'shell',
    content: `#!/usr/bin/env sh
set -eu

# Configure secrets via CI environment variables before running:
: "\${API_BASE_URL:?API_BASE_URL must be set}"
: "\${API_STUDIO_TOKEN:?API_STUDIO_TOKEN secret must be provided via CI store}"

${shellBody}
echo "Report generated: api-studio-report.${artifactExt}"
`,
  };
}

export function generateJunitXmlReport(params: {
  suiteName: string;
  cases: Array<{ name: string; classname: string; durationMs: number; failureMessage?: string }>;
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const failures = params.cases.filter((c) => Boolean(c.failureMessage)).length;
  const totalSecs = (
    params.cases.reduce((acc, c) => acc + c.durationMs, 0) / 1000
  ).toFixed(3);
  const body = params.cases
    .map((c) => {
      const dur = (c.durationMs / 1000).toFixed(3);
      if (c.failureMessage) {
        return `  <testcase classname="${esc(c.classname)}" name="${esc(c.name)}" time="${dur}">\n    <failure message="${esc(c.failureMessage)}" />\n  </testcase>`;
      }
      return `  <testcase classname="${esc(c.classname)}" name="${esc(c.name)}" time="${dur}" />`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${esc(params.suiteName)}" tests="${params.cases.length}" failures="${failures}" time="${totalSecs}">\n${body}\n</testsuite>\n`;
}
