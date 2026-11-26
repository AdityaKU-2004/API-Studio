import {
  ApiRequest,
  OpenApiSpecRecord,
  SecurityAuditConfig,
  SecurityAuditReport,
  SecurityFinding,
  SecuritySeverity,
} from '../../types';
import { httpClient } from '../http/httpClient';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from '../desktop/tauriBridge';
import { parseOpenApiDocument } from '../openapi/openapiParser';
import { substituteVariables } from '../variables/variableResolver';

const SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp; severity: SecuritySeverity }> = [
  {
    name: 'Private Key Material',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/i,
    severity: 'critical',
  },
  {
    name: 'AWS Access Key ID',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    severity: 'critical',
  },
  {
    name: 'Bearer / JWT Token Exposed in Body',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    severity: 'high',
  },
  {
    name: 'Stack Trace / Debug Exception Leak',
    regex: /(?:Traceback \(most recent call last\)|at [A-Za-z0-9_$.]+\([^)]+:\d+:\d+\)|Fatal error: Uncaught)/i,
    severity: 'medium',
  },
];

const RECOMMENDED_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'content-security-policy',
  'x-frame-options',
  'referrer-policy',
  'cache-control',
];

export function scrubSensitiveText(input: string): string {
  return input
    .replace(/Authorization:\s*Bearer\s+[^\s"']+/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/(password|secret|api[_-]?key|token)\s*[:=]\s*["']?[^"'\s,}]+/gi, '$1=[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[JWT_REDACTED]');
}

function makeFinding(partial: Omit<SecurityFinding, 'id' | 'detectedAt' | 'status'>): SecurityFinding {
  return {
    id: `secf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: 'open',
    detectedAt: Date.now(),
    ...partial,
    evidence: scrubSensitiveText(partial.evidence),
  };
}

export function auditOpenApiSecurity(
  auditId: string,
  spec: OpenApiSpecRecord
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const parsed = parseOpenApiDocument(spec.content);

  for (const srv of parsed.servers) {
    if (srv.url.trim().toLowerCase().startsWith('http://') && !srv.url.includes('localhost') && !srv.url.includes('127.0.0.1')) {
      findings.push(
        makeFinding({
          auditId,
          title: 'OpenAPI Server Uses Cleartext HTTP',
          severity: 'high',
          category: 'openapi-spec',
          affectedEndpoint: srv.url,
          specLocation: `servers[${srv.url}]`,
          evidence: `Server URL declared as '${srv.url}'`,
          explanation: 'Production or shared server URLs declared over plain http:// allow credential and payload interception.',
          remediation: 'Switch the server URL to https:// and enforce TLS redirects at the ingress layer.',
        })
      );
    }
  }

  if (parsed.securitySchemes.length === 0) {
    findings.push(
      makeFinding({
        auditId,
        title: 'No OpenAPI Security Schemes Defined',
        severity: 'medium',
        category: 'openapi-spec',
        affectedEndpoint: spec.name,
        specLocation: 'components.securitySchemes',
        evidence: 'components.securitySchemes is empty in parsed OpenAPI specification.',
        explanation: 'Without declared securitySchemes, API consumers and validators cannot verify authentication requirements.',
        remediation: 'Define appropriate OAuth2, bearer JWT, or API key schemes under components.securitySchemes.',
      })
    );
  }

  for (const scheme of parsed.securitySchemes) {
    if (scheme.in === 'query') {
      findings.push(
        makeFinding({
          auditId,
          title: `API Key Transmitted in Query String (${scheme.name})`,
          severity: 'medium',
          category: 'openapi-spec',
          affectedEndpoint: spec.name,
          specLocation: `components.securitySchemes.${scheme.name}`,
          evidence: `apiKey scheme '${scheme.name}' uses 'in: query'.`,
          explanation: 'Credentials passed in URL query strings are logged in proxies, web servers, and browser history.',
          remediation: 'Move API credentials to HTTP Authorization headers instead of URL query parameters.',
        })
      );
    }
  }

  for (const ep of parsed.endpoints) {
    if (ep.deprecated) {
      findings.push(
        makeFinding({
          auditId,
          title: `Deprecated Endpoint Still Listed (${ep.method} ${ep.path})`,
          severity: 'informational',
          category: 'openapi-spec',
          affectedEndpoint: `${ep.method} ${ep.path}`,
          specLocation: `paths.${ep.path}.${ep.method.toLowerCase()}`,
          evidence: 'Endpoint flagged as deprecated: true.',
          explanation: 'Deprecated endpoints often lag behind active routes in security patching and monitoring.',
          remediation: 'Verify deprecation sunset timelines and remove retired endpoints from production gateways.',
        })
      );
    }
  }

  return findings;
}

export async function runSecurityAudit(params: {
  config: SecurityAuditConfig;
  requests: ApiRequest[];
  specs: OpenApiSpecRecord[];
  resolvedVariables: Record<string, string>;
}): Promise<SecurityAuditReport> {
  const startedAt = Date.now();
  const auditId = `sec-rep-${startedAt}`;
  const findings: SecurityFinding[] = [];

  if (
    params.config.includeControlledActiveTests &&
    !params.config.confirmedActiveAuthorization
  ) {
    throw new Error(
      'Active security validation checks require explicit authorization confirmation.'
    );
  }

  // 1. Passive checks across requests (URL scheme, query secrets, auth config)
  for (const req of params.requests) {
    const resolvedUrl = substituteVariables(req.url, params.resolvedVariables);

    if (
      params.config.includePassiveHttps &&
      resolvedUrl.toLowerCase().startsWith('http://') &&
      !resolvedUrl.includes('localhost') &&
      !resolvedUrl.includes('127.0.0.1')
    ) {
      findings.push(
        makeFinding({
          auditId,
          title: 'Cleartext HTTP Endpoint Configured',
          severity: 'high',
          category: 'https',
          affectedEndpoint: `${req.method} ${resolvedUrl}`,
          evidence: `Request URL uses plain http:// instead of https://`,
          explanation: 'Unencrypted HTTP exposes tokens, session cookies, and API payloads to passive eavesdropping.',
          remediation: 'Use https:// endpoints for non-local environments.',
        })
      );
    }

    if (params.config.includeAuthChecks) {
      const hasQuerySecret = req.params.some(
        (q) =>
          q.enabled &&
          /(token|api[_-]?key|secret|password|auth)/i.test(q.key)
      );
      if (hasQuerySecret) {
        findings.push(
          makeFinding({
            auditId,
            title: 'Secret or Token Placed in URL Query Parameter',
            severity: 'medium',
            category: 'authentication',
            affectedEndpoint: `${req.method} ${resolvedUrl}`,
            evidence: 'Sensitive parameter name detected inside request query string.',
            explanation: 'Query parameters frequently appear in access logs and telemetry.',
            remediation: 'Transmit bearer tokens or API keys in Authorization or dedicated request headers.',
          })
        );
      }

      if (req.auth?.type === 'basic' && resolvedUrl.toLowerCase().startsWith('http://')) {
        findings.push(
          makeFinding({
            auditId,
            title: 'Basic Authentication Sent Over Plain HTTP',
            severity: 'critical',
            category: 'authentication',
            affectedEndpoint: `${req.method} ${resolvedUrl}`,
            evidence: 'Basic auth header configured with non-TLS http:// target.',
            explanation: 'Basic authentication encodes username and password with reversible Base64.',
            remediation: 'Enforce HTTPS before sending Basic authentication credentials.',
          })
        );
      }
    }

    // Native TLS / Header inspection for first 8 distinct endpoints if enabled
    if (
      (params.config.includeSecurityHeaders ||
        params.config.includeTlsInspection ||
        params.config.includeInfoExposure) &&
      resolvedUrl.startsWith('http')
    ) {
      if (isTauriRuntime()) {
        try {
          const nativeAudit = await invokeDesktop<{
            finalUrl: string;
            isHttps: boolean;
            responseHeaders: Record<string, string>;
            missingHeaders: string[];
            infoLeakWarnings: string[];
            certificate?: {
              certificate?: {
                isExpired: boolean;
                hostnameMatch: boolean;
                trustVerified: boolean;
                daysRemaining: number;
                verificationError?: string;
              };
            };
          }>('security_audit_endpoint', {
            url: resolvedUrl,
            includeTls: params.config.includeTlsInspection,
          });

          if (params.config.includeSecurityHeaders && nativeAudit.missingHeaders.length > 0) {
            findings.push(
              makeFinding({
                auditId,
                title: `Missing Recommended Security Headers (${nativeAudit.missingHeaders.length})`,
                severity: 'low',
                category: 'security-headers',
                affectedEndpoint: resolvedUrl,
                evidence: `Missing headers: ${nativeAudit.missingHeaders.join(', ')}`,
                explanation:
                  'Some security headers may be handled by a reverse proxy or CDN, or omitted intentionally for pure JSON APIs; review whether this endpoint needs browser-facing protection.',
                remediation: `Configure missing headers at the API gateway or server where applicable: ${nativeAudit.missingHeaders.join(', ')}.`,
              })
            );
          }

          if (params.config.includeInfoExposure) {
            for (const warn of nativeAudit.infoLeakWarnings) {
              findings.push(
                makeFinding({
                  auditId,
                  title: 'Server Version / Stack Header Disclosure',
                  severity: 'low',
                  category: 'info-exposure',
                  affectedEndpoint: resolvedUrl,
                  evidence: warn,
                  explanation: 'Advertising exact server versions helps attackers identify known framework CVEs.',
                  remediation: 'Suppress or normalize Server and X-Powered-By response headers.',
                })
              );
            }
          }

          const cert = nativeAudit.certificate?.certificate;
          if (params.config.includeTlsInspection && cert) {
            if (cert.isExpired || !cert.trustVerified || !cert.hostnameMatch) {
              findings.push(
                makeFinding({
                  auditId,
                  title: 'TLS Certificate Trust / Validity Issue',
                  severity: 'critical',
                  category: 'tls',
                  affectedEndpoint: resolvedUrl,
                  evidence: `expired=${cert.isExpired}, hostnameMatch=${cert.hostnameMatch}, trustVerified=${cert.trustVerified}${cert.verificationError ? ` (${cert.verificationError})` : ''}`,
                  explanation: 'Invalid, expired, or untrusted certificates weaken transport integrity.',
                  remediation: 'Install a valid CA-signed certificate matching the target hostname.',
                })
              );
            } else if (cert.daysRemaining <= 30) {
              findings.push(
                makeFinding({
                  auditId,
                  title: `TLS Certificate Expiring Soon (${cert.daysRemaining} days)`,
                  severity: 'medium',
                  category: 'tls',
                  affectedEndpoint: resolvedUrl,
                  evidence: `Certificate expires in ${cert.daysRemaining} days.`,
                  explanation: 'Certificates close to expiration risk unexpected service outages.',
                  remediation: 'Renew the TLS certificate before expiration.',
                })
              );
            }
          }
        } catch {
          // Offline / unreachable target; fall through gracefully
        }
      } else {
        // Browser passive HTTP header + exposure check via standardized httpClient
        try {
          const res = await httpClient.execute(req, {
            tabId: `secaudit-${req.id}`,
            resolvedVariables: params.resolvedVariables,
            timeoutMs: 8000,
          });

          if (params.config.includeSecurityHeaders && res.status > 0) {
            const lowerHeaders = Object.keys(res.headers).map((k) => k.toLowerCase());
            const missing = RECOMMENDED_HEADERS.filter((h) => !lowerHeaders.includes(h));
            if (missing.length > 0) {
              findings.push(
                makeFinding({
                  auditId,
                  title: `Missing Security Headers (${missing.length})`,
                  severity: 'low',
                  category: 'security-headers',
                  affectedEndpoint: resolvedUrl,
                  evidence: `Headers absent in visible response: ${missing.join(', ')}`,
                  explanation: 'Context note: CDNs or gateways may manage headers externally, and browser CORS restricts visibility of some headers.',
                  remediation: 'Verify security header policy on your API gateway or edge proxy.',
                })
              );
            }
          }

          if (params.config.includeInfoExposure && res.body) {
            for (const pat of SENSITIVE_PATTERNS) {
              if (pat.regex.test(res.body)) {
                findings.push(
                  makeFinding({
                    auditId,
                    title: pat.name,
                    severity: pat.severity,
                    category: 'info-exposure',
                    affectedEndpoint: resolvedUrl,
                    evidence: `Pattern '${pat.name}' matched in HTTP response body.`,
                    explanation: 'Sensitive secrets or internal error diagnostics were observed in the API response.',
                    remediation: 'Disable verbose error stacks in production and scrub sensitive values from payloads.',
                  })
                );
              }
            }
          }
        } catch {
          // Non-fatal network check error
        }
      }
    }

    // Controlled Active Validation (ONLY when explicitly enabled + confirmed)
    if (
      params.config.includeControlledActiveTests &&
      params.config.confirmedActiveAuthorization &&
      resolvedUrl.startsWith('http')
    ) {
      try {
        const unauthReq: ApiRequest = {
          ...req,
          auth: { type: 'none' },
          headers: req.headers.filter(
            (h) => !['authorization', 'x-api-key', 'cookie'].includes(h.key.toLowerCase())
          ),
        };
        const unauthRes = await httpClient.execute(unauthReq, {
          tabId: `secaudit-active-${req.id}`,
          resolvedVariables: params.resolvedVariables,
          timeoutMs: 8000,
        });

        if (req.auth?.type && req.auth.type !== 'none' && unauthRes.status >= 200 && unauthRes.status < 300) {
          findings.push(
            makeFinding({
              auditId,
              title: 'Authenticated Route Succeeded Without Credentials',
              severity: 'high',
              category: 'active-validation',
              affectedEndpoint: `${req.method} ${resolvedUrl}`,
              evidence: `Unauthenticated probe returned HTTP ${unauthRes.status} on a request configured with '${req.auth.type}' auth.`,
              explanation: 'Endpoints expecting authentication should reject missing credentials with 401 or 403.',
              remediation: 'Enforce authentication middleware consistently on protected routes.',
            })
          );
        }

        const acao = Object.entries(unauthRes.headers).find(
          ([k]) => k.toLowerCase() === 'access-control-allow-origin'
        )?.[1];
        const acac = Object.entries(unauthRes.headers).find(
          ([k]) => k.toLowerCase() === 'access-control-allow-credentials'
        )?.[1];
        if (acao === '*' && acac?.toLowerCase() === 'true') {
          findings.push(
            makeFinding({
              auditId,
              title: 'Permissive CORS Wildcard with Credentials',
              severity: 'high',
              category: 'active-validation',
              affectedEndpoint: resolvedUrl,
              evidence: 'Access-Control-Allow-Origin: * paired with Access-Control-Allow-Credentials: true.',
              explanation: 'Combining wildcard CORS with credentials violates browser security best practices.',
              remediation: 'Restrict Access-Control-Allow-Origin to an explicit origin allowlist.',
            })
          );
        }
      } catch {
        // Non-fatal active probe failure
      }
    }
  }

  // 2. OpenAPI spec static security audit
  if (params.config.includeOpenApiAnalysis) {
    const targetSpecs = params.config.specId
      ? params.specs.filter((s) => s.id === params.config.specId)
      : params.specs;
    for (const sp of targetSpecs) {
      findings.push(...auditOpenApiSecurity(auditId, sp));
    }
  }

  const summaryCounts: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };
  for (const f of findings) {
    summaryCounts[f.severity]++;
  }

  return {
    id: auditId,
    configId: params.config.id,
    name: params.config.name,
    startedAt,
    completedAt: Date.now(),
    findings,
    summaryCounts,
  };
}

export function exportSecurityReportAsJson(report: SecurityAuditReport): string {
  return JSON.stringify(
    {
      ...report,
      findings: report.findings.map((f) => ({
        ...f,
        evidence: scrubSensitiveText(f.evidence),
      })),
    },
    null,
    2
  );
}

export function exportSecurityReportAsHtml(report: SecurityAuditReport): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = report.findings
    .map(
      (f) => `<tr>
        <td>${esc(f.severity.toUpperCase())}</td>
        <td>${esc(f.title)}</td>
        <td>${esc(f.affectedEndpoint)}</td>
        <td>${esc(f.status)}</td>
        <td>${esc(scrubSensitiveText(f.evidence))}</td>
      </tr>`
    )
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Security Audit - ${esc(report.name)}</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}</style>
</head>
<body>
  <h1>API Security Audit Report: ${esc(report.name)}</h1>
  <p>Findings: Critical ${report.summaryCounts.critical} · High ${report.summaryCounts.high} · Medium ${report.summaryCounts.medium} · Low ${report.summaryCounts.low} · Info ${report.summaryCounts.informational}</p>
  <table>
    <thead><tr><th>Severity</th><th>Title</th><th>Endpoint / Resource</th><th>Status</th><th>Evidence</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
