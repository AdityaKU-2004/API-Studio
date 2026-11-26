import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  auditOpenApiSecurity,
  exportSecurityReportAsHtml,
  exportSecurityReportAsJson,
  runSecurityAudit,
  scrubSensitiveText,
} from '../../services/security/securityAuditor';
import {
  compareEnvironments,
  exportEnvironmentAsSafeTemplate,
  parseEnvironmentTemplatePreview,
  validateEnvironmentConfiguration,
} from '../../services/environments/envValidationService';
import { createDefaultRequest } from '../../stores/requestStore';
import { httpClient } from '../../services/http/httpClient';
import { Environment, OpenApiSpecRecord, SecurityAuditConfig } from '../../types';

const INSECURE_OPENAPI_SPEC: OpenApiSpecRecord = {
  id: 'spec-sec-1',
  projectId: 'proj-1',
  workspaceId: 'ws-1',
  name: 'Legacy Gateway',
  version: '1.0.0',
  format: 'yaml',
  sourceType: 'manual',
  content: `openapi: 3.0.3
info:
  title: Legacy Gateway
  version: 1.0.0
servers:
  - url: http://api.public-gateway.example.com/v1
components:
  securitySchemes:
    QueryKeyAuth:
      type: apiKey
      in: query
      name: api_key
paths:
  /legacy/users:
    get:
      deprecated: true
      responses:
        '200':
          description: OK
`,
  createdAt: 1,
  updatedAt: 1,
};

describe('Phase 9: Security Auditing & Environment Validation/Comparison', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('audits OpenAPI specs, scrubs sensitive evidence, and enforces active confirmation', async () => {
    const specFindings = auditOpenApiSecurity('aud-1', INSECURE_OPENAPI_SPEC);
    expect(specFindings.some((f) => f.title.includes('Cleartext HTTP'))).toBe(true);
    expect(specFindings.some((f) => f.title.includes('Query String'))).toBe(true);
    expect(specFindings.some((f) => f.title.includes('Deprecated Endpoint'))).toBe(true);

    const scrubbed = scrubSensitiveText(
      'Authorization: Bearer my-super-secret-jwt-token password="top-secret"'
    );
    expect(scrubbed).not.toContain('my-super-secret-jwt-token');
    expect(scrubbed).not.toContain('top-secret');

    const baseAuditConfig: SecurityAuditConfig = {
      id: 'sec-cfg-1',
      name: 'API Security Scan',
      includePassiveHttps: true,
      includeTlsInspection: false,
      includeSecurityHeaders: true,
      includeAuthChecks: true,
      includeInfoExposure: true,
      includeOpenApiAnalysis: true,
      includeControlledActiveTests: true,
      confirmedActiveAuthorization: false,
      customExposurePatterns: [],
      updatedAt: 1,
    };

    await expect(
      runSecurityAudit({
        config: baseAuditConfig,
        requests: [],
        specs: [INSECURE_OPENAPI_SPEC],
        resolvedVariables: {},
      })
    ).rejects.toThrow(/authorization confirmation/i);

    vi.spyOn(httpClient, 'execute').mockResolvedValue({
      id: 'r1',
      requestId: 'req-1',
      url: 'http://api.example.com/admin',
      method: 'GET',
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-credentials': 'true',
      },
      body: '{"secret":"AKIA1234567890ABCDEF"}',
      rawBody: '{"secret":"AKIA1234567890ABCDEF"}',
      contentType: 'application/json',
      contentTypeCategory: 'json',
      size: 32,
      sizeBytes: 32,
      timeMs: 10,
      timing: { startTime: 0, endTime: 10, duration: 10, prepareMs: 1, waitingMs: 8, downloadMs: 1 },
      receivedAt: new Date().toISOString(),
      timestamp: Date.now(),
      cookies: [],
      tests: [],
    });

    const req = {
      ...createDefaultRequest('Admin Check', 'GET'),
      url: 'http://api.example.com/admin?api_key=abc',
      auth: { type: 'basic' as const, basic: { username: 'admin', password: 'pw' } },
      params: [{ id: 'q1', key: 'api_key', value: 'abc', enabled: true }],
    };

    const report = await runSecurityAudit({
      config: { ...baseAuditConfig, confirmedActiveAuthorization: true },
      requests: [req],
      specs: [INSECURE_OPENAPI_SPEC],
      resolvedVariables: {},
    });

    expect(report.findings.some((f) => f.category === 'https')).toBe(true);
    expect(report.findings.some((f) => f.title.includes('Basic Authentication'))).toBe(true);
    expect(report.findings.some((f) => f.title.includes('AWS Access Key'))).toBe(true);
    expect(report.findings.some((f) => f.title.includes('Permissive CORS'))).toBe(true);
    expect(report.findings.some((f) => f.title.includes('Authenticated Route Succeeded'))).toBe(true);

    const jsonExport = exportSecurityReportAsJson(report);
    expect(JSON.parse(jsonExport).id).toBe(report.id);
    expect(exportSecurityReportAsHtml(report)).toContain('API Security Audit Report');
  });

  it('compares environments safely masking secrets and validates environment configuration', () => {
    const staging: Environment = {
      id: 'env-stg',
      name: 'Staging',
      profileType: 'staging',
      variables: [
        { id: 'v1', key: 'base_url', initialValue: 'https://stg.api.test', currentValue: 'https://stg.api.test', description: '', isSecret: false, enabled: true },
        { id: 'v2', key: 'api_token', initialValue: 'stg-secret-123', currentValue: 'stg-secret-123', description: '', isSecret: true, enabled: true },
        { id: 'v3', key: 'port', initialValue: '8080', currentValue: '8080', description: '', isSecret: false, enabled: true },
      ],
      createdAt: 1,
      updatedAt: 1,
    };

    const prod: Environment = {
      id: 'env-prd',
      name: 'Production',
      profileType: 'production',
      variables: [
        { id: 'v1', key: 'base_url', initialValue: 'https://api.test', currentValue: 'https://api.test', description: '', isSecret: false, enabled: true },
        { id: 'v2', key: 'api_token', initialValue: 'prd-secret-999', currentValue: 'prd-secret-999', description: '', isSecret: true, enabled: true },
        { id: 'v4', key: 'region', initialValue: 'us-east-1', currentValue: 'us-east-1', description: '', isSecret: false, enabled: true },
      ],
      createdAt: 1,
      updatedAt: 1,
    };

    const diffs = compareEnvironments(staging, prod);
    const tokenDiff = diffs.find((d) => d.key === 'api_token');
    expect(tokenDiff?.changeType).toBe('changed');
    expect(tokenDiff?.leftValueMasked).toContain('masked secret');
    expect(tokenDiff?.leftValueMasked).not.toContain('stg-secret-123');
    expect(tokenDiff?.rightValueMasked).not.toContain('prd-secret-999');
    expect(diffs.find((d) => d.key === 'port')?.changeType).toBe('removed');
    expect(diffs.find((d) => d.key === 'region')?.changeType).toBe('added');

    const badEnv: Environment = {
      id: 'env-bad',
      name: 'Broken',
      profileType: 'development',
      variables: [
        { id: 'b1', key: 'base_url', initialValue: 'http://[invalid-host', currentValue: 'http://[invalid-host', description: '', isSecret: false, enabled: true },
        { id: 'b2', key: 'service_port', initialValue: '99999', currentValue: '99999', description: '', isSecret: false, enabled: true },
        { id: 'b3', key: 'service_port', initialValue: '8080', currentValue: '8080', description: '', isSecret: false, enabled: true },
      ],
      createdAt: 1,
      updatedAt: 1,
    };

    const validation = validateEnvironmentConfiguration({
      environment: badEnv,
      referencedVariablesInRequests: ['missing_req_var'],
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((i) => i.category === 'invalid-url')).toBe(true);
    expect(validation.issues.some((i) => i.category === 'invalid-type')).toBe(true);
    expect(validation.issues.some((i) => i.category === 'duplicate-key')).toBe(true);
    expect(validation.issues.some((i) => i.category === 'unresolved-reference')).toBe(true);

    const safeTemplate = exportEnvironmentAsSafeTemplate(prod);
    expect(safeTemplate.includesSecrets).toBe(false);
    const secretVar = safeTemplate.variables.find((v) => v.key === 'api_token');
    expect(secretVar?.initialValue).toBe('');
    expect(JSON.stringify(safeTemplate)).not.toContain('prd-secret-999');

    const preview = parseEnvironmentTemplatePreview(JSON.stringify(safeTemplate));
    expect(preview.valid).toBe(true);
    expect(preview.template?.name).toBe('Production Template');
  });
});
