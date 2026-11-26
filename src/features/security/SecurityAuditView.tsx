import React, { useMemo, useState } from 'react';
import {
  ShieldAlert,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  ApiRequest,
  CollectionItem,
  SecurityAuditConfig,
  SecurityFindingStatus,
  SecuritySeverity,
} from '../../types';
import { useCollectionStore } from '../../stores/collectionStore';
import { useSpecStore } from '../../stores/specStore';
import { useSecurityAuditStore } from '../../stores/securityAuditStore';
import {
  exportSecurityReportAsHtml,
  exportSecurityReportAsJson,
} from '../../services/security/securityAuditor';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

function collectAllRequests(items: CollectionItem[]): ApiRequest[] {
  const res: ApiRequest[] = [];
  for (const it of items) {
    if (it.type === 'request' && it.request) res.push(it.request);
    if (it.children) res.push(...collectAllRequests(it.children));
  }
  return res;
}

export const SecurityAuditView: React.FC = () => {
  const { collections } = useCollectionStore();
  const { specs } = useSpecStore();
  const {
    findings,
    latestReport,
    isAuditing,
    error,
    executeAudit,
    updateFindingStatus,
    deleteFinding,
  } = useSecurityAuditStore();

  const requests = useMemo(() => collectAllRequests(collections), [collections]);

  const [auditName, setAuditName] = useState('Baseline Security Audit');
  const [selectedSpecId, setSelectedSpecId] = useState<string>('');
  const [includePassiveHttps, setIncludePassiveHttps] = useState(true);
  const [includeTlsInspection, setIncludeTlsInspection] = useState(true);
  const [includeSecurityHeaders, setIncludeSecurityHeaders] = useState(true);
  const [includeAuthChecks, setIncludeAuthChecks] = useState(true);
  const [includeInfoExposure, setIncludeInfoExposure] = useState(true);
  const [includeOpenApiAnalysis, setIncludeOpenApiAnalysis] = useState(true);
  const [includeControlledActiveTests, setIncludeControlledActiveTests] = useState(false);
  const [confirmActiveModal, setConfirmActiveModal] = useState(false);

  const [severityFilter, setSeverityFilter] = useState<SecuritySeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SecurityFindingStatus | 'all'>('all');

  const runAuditWithAuth = async (confirmedActive: boolean) => {
    setConfirmActiveModal(false);
    const config: SecurityAuditConfig = {
      id: `seccfg-${Date.now()}`,
      name: auditName.trim() || 'Security Audit',
      specId: selectedSpecId || undefined,
      includePassiveHttps,
      includeTlsInspection,
      includeSecurityHeaders,
      includeAuthChecks,
      includeInfoExposure,
      includeOpenApiAnalysis,
      includeControlledActiveTests,
      confirmedActiveAuthorization: confirmedActive,
      customExposurePatterns: [],
      updatedAt: Date.now(),
    };
    await executeAudit({ config, requests, specs });
  };

  const handleTriggerAudit = () => {
    if (includeControlledActiveTests) {
      setConfirmActiveModal(true);
    } else {
      void runAuditWithAuth(false);
    }
  };

  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    return true;
  });

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const severityColor = (sev: SecuritySeverity) => {
    switch (sev) {
      case 'critical':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-amber-500';
      case 'low':
        return 'text-cyan-500';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <div>
            <h1 className="text-sm font-semibold">API Security Auditing</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Passive HTTPS, TLS certificate, header policy, exposure scanning &amp; authorized validation checks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {latestReport && (
            <>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    exportSecurityReportAsJson(latestReport),
                    `security-audit-${latestReport.id}.json`,
                    'application/json'
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    exportSecurityReportAsHtml(latestReport),
                    `security-audit-${latestReport.id}.html`,
                    'text/html'
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>HTML</span>
              </button>
            </>
          )}
          <button
            type="button"
            disabled={isAuditing}
            onClick={handleTriggerAudit}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isAuditing ? 'Auditing...' : 'Run Security Audit'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Options Panel */}
        <div className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] p-4 space-y-4 overflow-y-auto shrink-0 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1">Audit Name</label>
            <input
              type="text"
              value={auditName}
              onChange={(e) => setAuditName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1">
              OpenAPI Spec Scope
            </label>
            <select
              value={selectedSpecId}
              onChange={(e) => setSelectedSpecId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="">All OpenAPI Specs ({specs.length})</option>
              {specs.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} (v{sp.version})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="font-medium text-slate-600 dark:text-slate-300">Passive Checks</div>
            {[
              ['HTTPS Enforcement', includePassiveHttps, setIncludePassiveHttps],
              ['TLS Certificate Inspection', includeTlsInspection, setIncludeTlsInspection],
              ['Security Headers Policy', includeSecurityHeaders, setIncludeSecurityHeaders],
              ['Auth Misconfiguration', includeAuthChecks, setIncludeAuthChecks],
              ['Secret & Info Exposure', includeInfoExposure, setIncludeInfoExposure],
              ['OpenAPI Security Spec', includeOpenApiAnalysis, setIncludeOpenApiAnalysis],
            ].map(([label, val, setter]) => (
              <label key={String(label)} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(val)}
                  onChange={(e) =>
                    (setter as React.Dispatch<React.SetStateAction<boolean>>)(e.target.checked)
                  }
                />
                <span>{String(label)}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-start gap-2 cursor-pointer text-amber-600 dark:text-amber-400">
              <input
                type="checkbox"
                checked={includeControlledActiveTests}
                onChange={(e) => setIncludeControlledActiveTests(e.target.checked)}
                className="mt-0.5"
              />
              <span>Controlled Active Checks (unauth &amp; CORS probes; requires authorization)</span>
            </label>
          </div>
        </div>

        {/* Findings List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-1.5">
              {(['all', 'critical', 'high', 'medium', 'low', 'informational'] as const).map(
                (sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded-md capitalize cursor-pointer ${
                      severityFilter === sev
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {sev}
                  </button>
                )
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SecurityFindingStatus | 'all')}
              className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="accepted-risk">Accepted Risk</option>
            </select>
          </div>

          {filteredFindings.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-500">
              <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-emerald-500" />
              <div>No security findings match the active filters.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold uppercase ${severityColor(finding.severity)}`}>
                          {finding.severity}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-semibold text-sm">{finding.title}</span>
                      </div>
                      <div className="text-slate-500 font-mono mt-0.5">
                        {finding.affectedEndpoint}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={finding.status}
                        onChange={(e) =>
                          void updateFindingStatus(
                            finding.id,
                            e.target.value as SecurityFindingStatus
                          )
                        }
                        className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                      >
                        <option value="open">Open</option>
                        <option value="resolved">Resolved</option>
                        <option value="accepted-risk">Accepted Risk</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void deleteFinding(finding.id)}
                        className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                        title="Delete finding"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-600 dark:text-slate-300">{finding.explanation}</p>
                  <div className="p-2 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[11px] break-all">
                    Evidence: {finding.evidence}
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400">
                    Remediation: {finding.remediation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmActiveModal}
        onClose={() => setConfirmActiveModal(false)}
        onConfirm={() => void runAuditWithAuth(true)}
        title="Authorize Controlled Active Security Probes"
        message="Active checks send non-destructive unauthenticated and CORS validation requests to your configured target endpoints. Confirm you have permission to test these endpoints."
      />
    </div>
  );
};
