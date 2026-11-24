import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
} from 'lucide-react';
import { useSpecStore } from '../../stores/specStore';
import { useContractStore } from '../../stores/contractStore';
import {
  exportContractReportAsCsv,
  exportContractReportAsHtml,
  exportContractReportAsJson,
} from '../../services/contract/contractTester';
import { MethodBadge } from '../../components/common/MethodBadge';
import { HttpMethod } from '../../types';

export const ContractTestingView: React.FC = () => {
  const { specs, activeSpecId, parsedDoc, selectSpec } = useSpecStore();
  const {
    reports,
    activeReport,
    liveResults,
    isRunning,
    progress,
    selectReport,
    deleteReport,
    runContractSuite,
    stopRun,
  } = useContractStore();

  const [baseUrl, setBaseUrl] = useState('');
  const [strictAdditional, setStrictAdditional] = useState(false);

  useEffect(() => {
    if (parsedDoc?.servers?.[0]?.url) {
      setBaseUrl(parsedDoc.servers[0].url);
    }
  }, [parsedDoc?.title, activeSpecId]);

  const handleRun = async () => {
    if (!activeSpecId || !parsedDoc) return;
    await runContractSuite({
      specId: activeSpecId,
      parsedDoc,
      baseUrl: baseUrl.trim() || parsedDoc.servers[0]?.url || 'https://jsonplaceholder.typicode.com',
      strictNoAdditionalProperties: strictAdditional,
    });
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayResults = isRunning ? liveResults : activeReport?.results || [];

  return (
    <div className="h-full flex flex-col bg-[#0d111a] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileCheck2 className="w-4 h-4 text-emerald-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">
              OpenAPI Contract Testing Runner
            </h1>
            <p className="text-[11px] text-slate-400">
              Validate live API status codes, headers, and JSON response schemas against your OpenAPI contract.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={activeSpecId || ''}
            onChange={(e) => selectSpec(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
          >
            {specs.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} (v{sp.version})
              </option>
            ))}
          </select>

          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
            className="w-64 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-cyan-300"
          />

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={strictAdditional}
              onChange={(e) => setStrictAdditional(e.target.checked)}
            />
            <span>Strict Props</span>
          </label>

          {isRunning ? (
            <button
              type="button"
              onClick={stopRun}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop ({progress.current}/{progress.total})</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!parsedDoc}
              onClick={handleRun}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Contract Tests</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Saved Reports List */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#10141f] p-3 space-y-2 overflow-y-auto shrink-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            Contract Test Reports ({reports.length})
          </div>
          {reports.map((rep) => (
            <div
              key={rep.id}
              onClick={() => selectReport(rep.id)}
              className={`p-3 rounded-xl border cursor-pointer space-y-1 ${
                activeReport?.id === rep.id
                  ? 'bg-blue-950/30 border-cyan-500/40'
                  : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold truncate">{rep.specName}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteReport(rep.id);
                  }}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={
                    rep.status === 'passed' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'
                  }
                >
                  {rep.passedCount}/{rep.results.length} Passed
                </span>
                <span className="text-slate-500">{rep.durationMs}ms</span>
              </div>
            </div>
          ))}
        </aside>

        {/* Active Report Detail */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeReport && !isRunning && (
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {activeReport.specName} — {activeReport.passedCount}/{activeReport.results.length} Passed
                </div>
                <div className="text-xs text-slate-400 font-mono">{activeReport.baseUrl}</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      exportContractReportAsJson(activeReport),
                      `contract-report-${activeReport.id}.json`,
                      'application/json'
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      exportContractReportAsCsv(activeReport),
                      `contract-report-${activeReport.id}.csv`,
                      'text/csv'
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      exportContractReportAsHtml(activeReport),
                      `contract-report-${activeReport.id}.html`,
                      'text/html'
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>HTML</span>
                </button>
              </div>
            </div>
          )}

          {displayResults.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500">
              Click &ldquo;Run Contract Tests&rdquo; to validate live responses against the active OpenAPI specification.
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayResults.map((res) => (
                <div
                  key={res.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    res.passed
                      ? 'bg-emerald-950/15 border-emerald-500/30'
                      : 'bg-red-950/20 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <MethodBadge method={res.method as HttpMethod} size="sm" />
                      <code className="font-mono text-slate-100 truncate">{res.path}</code>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
                      <span className="text-slate-300">
                        HTTP {res.statusCode ?? 'ERR'}
                      </span>
                      <span className="text-slate-500">{res.durationMs}ms</span>
                    </div>
                  </div>

                  {res.issues.length > 0 && (
                    <div className="space-y-1 pt-1 pl-6">
                      {res.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-2 rounded bg-slate-950/80 border border-red-500/20 text-[11px] space-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-amber-300">{issue.jsonPath}</span>
                            <span className="uppercase text-[10px] text-red-400">
                              {issue.issueType}
                            </span>
                          </div>
                          <div className="text-slate-200">{issue.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
