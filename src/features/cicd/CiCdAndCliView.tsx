import React, { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { GitCommitHorizontal, Terminal, Copy, Download, Play } from 'lucide-react';
import {
  CiPipelineOptions,
  CiProviderType,
  CliConfiguration,
  PipelineTemplateKind,
} from '../../types';
import { useCollectionStore } from '../../stores/collectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useUiStore } from '../../stores/uiStore';
import { generateCiPipelineConfig } from '../../services/cicd/pipelineGenerator';
import {
  buildCliCommandLine,
  CLI_EXIT_CODES,
  runDesktopCliPreview,
} from '../../services/cli/cliConfigService';

export const CiCdAndCliView: React.FC<{ initialTab?: 'cicd' | 'cli' }> = ({
  initialTab = 'cicd',
}) => {
  const { theme } = useUiStore();
  const { collections } = useCollectionStore();
  const { environments } = useEnvironmentStore();

  const [activeTab, setActiveTab] = useState<'cicd' | 'cli'>(initialTab);
  const [provider, setProvider] = useState<CiProviderType>('github-actions');
  const [template, setTemplate] = useState<PipelineTemplateKind>('full-regression');
  const [projectName, setProjectName] = useState('Core API');
  const [collectionName, setCollectionName] = useState(
    collections.find((c) => c.type === 'collection')?.name || 'Core API Collection'
  );
  const [environmentName, setEnvironmentName] = useState(environments[0]?.name || 'Staging');
  const [specPath, setSpecPath] = useState('openapi.yaml');
  const [runContractTests, setRunContractTests] = useState(true);
  const [runSecurityChecks, setRunSecurityChecks] = useState(true);
  const [validateOpenApi, setValidateOpenApi] = useState(true);
  const [reportFormat, setReportFormat] = useState<CiPipelineOptions['reportFormat']>('junit-xml');
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);

  // CLI builder state
  const [subcommand, setSubcommand] =
    useState<CliConfiguration['subcommand']>('run collection');
  const [cliPath, setCliPath] = useState('./api-studio.db');
  const [cliFormat, setCliFormat] = useState<CliConfiguration['outputFormat']>('terminal');
  const [cliPreviewOut, setCliPreviewOut] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState(false);

  const generatedPipeline = useMemo(
    () =>
      generateCiPipelineConfig({
        provider,
        template,
        projectName,
        collectionName,
        environmentName,
        specPath,
        runContractTests,
        runSecurityChecks,
        validateOpenApi,
        reportFormat,
        timeoutSeconds,
      }),
    [
      provider,
      template,
      projectName,
      collectionName,
      environmentName,
      specPath,
      runContractTests,
      runSecurityChecks,
      validateOpenApi,
      reportFormat,
      timeoutSeconds,
    ]
  );

  const cliCommand = useMemo(
    () =>
      buildCliCommandLine({
        id: 'cli-preview',
        name: 'CLI Preview',
        subcommand,
        projectPath: cliPath,
        collectionName,
        environmentName,
        outputFormat: cliFormat,
        timeoutSeconds,
        verbose: false,
        updatedAt: Date.now(),
      }),
    [subcommand, cliPath, collectionName, environmentName, cliFormat, timeoutSeconds]
  );

  const handleCopy = async (text: string) => {
    await navigator.clipboard?.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedPipeline.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedPipeline.filename.split('/').pop() || 'pipeline.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreviewCli = async () => {
    const res = await runDesktopCliPreview({
      subcommand,
      targetUrl: cliPath.startsWith('http') ? cliPath : undefined,
      specPath: !cliPath.startsWith('http') ? cliPath : undefined,
    });
    setCliPreviewOut(JSON.stringify(res, null, 2));
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {activeTab === 'cicd' ? (
            <GitCommitHorizontal className="w-4 h-4 text-blue-500" />
          ) : (
            <Terminal className="w-4 h-4 text-cyan-500" />
          )}
          <div>
            <h1 className="text-sm font-semibold">CI/CD Pipeline &amp; Headless CLI Studio</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate secret-safe CI/CD pipelines and configure headless api-studio CLI workflows.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('cicd')}
            className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
              activeTab === 'cicd' ? 'bg-blue-600 text-white' : 'text-slate-500'
            }`}
          >
            CI/CD Generator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cli')}
            className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
              activeTab === 'cli' ? 'bg-blue-600 text-white' : 'text-slate-500'
            }`}
          >
            API CLI (api-studio)
          </button>
        </div>
      </div>

      {activeTab === 'cicd' ? (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] p-4 overflow-y-auto space-y-3 text-xs shrink-0">
            <div>
              <label className="block text-slate-500 mb-1">CI/CD Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as CiProviderType)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="github-actions">GitHub Actions</option>
                <option value="gitlab-ci">GitLab CI</option>
                <option value="jenkins">Jenkinsfile</option>
                <option value="shell">Generic POSIX Shell</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Pipeline Template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as PipelineTemplateKind)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="basic-tests">Basic API Tests</option>
                <option value="full-regression">Full API Regression</option>
                <option value="contract-validation">OpenAPI Contract Validation</option>
                <option value="security-checks">Security Checks</option>
                <option value="smoke-tests">Release Smoke Tests</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Collection Name</label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Environment Name</label>
              <input
                type="text"
                value={environmentName}
                onChange={(e) => setEnvironmentName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">OpenAPI Spec Path</label>
              <input
                type="text"
                value={specPath}
                onChange={(e) => setSpecPath(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Report Format</label>
              <select
                value={reportFormat}
                onChange={(e) =>
                  setReportFormat(e.target.value as CiPipelineOptions['reportFormat'])
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              >
                <option value="junit-xml">JUnit XML</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={validateOpenApi}
                  onChange={(e) => setValidateOpenApi(e.target.checked)}
                />
                <span>Validate OpenAPI Spec</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={runContractTests}
                  onChange={(e) => setRunContractTests(e.target.checked)}
                />
                <span>Include Contract Checks</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={runSecurityChecks}
                  onChange={(e) => setRunSecurityChecks(e.target.checked)}
                />
                <span>Include Security Audit</span>
              </label>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono">{generatedPipeline.filename}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy(generatedPipeline.content)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedNotice ? 'Copied' : 'Copy Config'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <div className="flex-1 rounded-lg border border-slate-300 dark:border-slate-800 overflow-hidden">
              <Editor
                height="100%"
                language={generatedPipeline.language}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                value={generatedPipeline.content}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs max-w-4xl">
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-3">
            <div className="font-semibold text-sm">API CLI Command Builder (`api-studio`)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Subcommand</label>
                <select
                  value={subcommand}
                  onChange={(e) =>
                    setSubcommand(e.target.value as CliConfiguration['subcommand'])
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  <option value="run collection">run collection</option>
                  <option value="run tests">run tests</option>
                  <option value="run contract-tests">run contract-tests</option>
                  <option value="run security-audit">run security-audit</option>
                  <option value="run performance-test">run performance-test</option>
                  <option value="validate openapi">validate openapi</option>
                  <option value="generate report">generate report</option>
                  <option value="export collection">export collection</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Target DB / Spec / URL</label>
                <input
                  type="text"
                  value={cliPath}
                  onChange={(e) => setCliPath(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Output Format</label>
                <select
                  value={cliFormat}
                  onChange={(e) =>
                    setCliFormat(e.target.value as CliConfiguration['outputFormat'])
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  <option value="terminal">Terminal</option>
                  <option value="json">JSON</option>
                  <option value="junit-xml">JUnit XML</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded bg-slate-100 dark:bg-slate-900 font-mono flex items-center justify-between gap-2">
              <span className="truncate">{cliCommand}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleCopy(cliCommand)}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => void handlePreviewCli()}
                  className="px-2.5 py-1 rounded bg-blue-600 text-white flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {cliPreviewOut && (
              <pre className="p-3 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[11px] overflow-x-auto">
                {cliPreviewOut}
              </pre>
            )}
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-2">
            <div className="font-semibold">Documented CLI Exit Codes</div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {CLI_EXIT_CODES.map((ec) => (
                <div key={ec.code} className="py-2 flex items-center gap-4">
                  <span className="font-mono font-bold w-12">Exit {ec.code}</span>
                  <span>{ec.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
