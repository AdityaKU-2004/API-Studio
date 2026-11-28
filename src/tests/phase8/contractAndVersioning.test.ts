import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import {
  exportContractReportAsCsv,
  exportContractReportAsHtml,
  exportContractReportAsJson,
  normalizeSchemaForAjv,
  validateEndpointContract,
  validateJsonAgainstContractSchema,
} from '../../services/contract/contractTester';
import { compareApiSpecVersions } from '../../services/openapi/specDiffEngine';
import { parseOpenApiDocument } from '../../services/openapi/openapiParser';
import { createDefaultRequest } from '../../stores/requestStore';
import { db } from '../../database/database';
import { useSpecStore } from '../../stores/specStore';
import { ApiResponse, ApiVersionEntry } from '../../types';

const BASE_SPEC = `openapi: 3.0.3
info:
  title: Billing API
  version: 1.0.0
servers:
  - url: https://billing.test
paths:
  /invoices/{id}:
    get:
      summary: Fetch invoice
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: expand
          in: query
          required: false
          schema:
            type: string
      responses:
        '200':
          description: OK
          headers:
            X-RateLimit:
              required: true
              schema:
                type: string
          content:
            application/json:
              schema:
                type: object
                required: [id, amount, customerNote]
                properties:
                  id:
                    type: string
                  amount:
                    type: number
                  customerNote:
                    type: string
                    nullable: true
  /invoices:
    delete:
      summary: Purge draft invoices
      responses:
        '204':
          description: Purged
`;

const TARGET_SPEC = `openapi: 3.0.3
info:
  title: Billing API
  version: 2.0.0
servers:
  - url: https://billing.test
paths:
  /invoices/{id}:
    get:
      summary: Fetch invoice
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: expand
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [id, amount]
                properties:
                  id:
                    type: string
                  amount:
                    type: string
  /invoices/export:
    post:
      summary: Export invoices
      responses:
        '202':
          description: Accepted
`;

function makeResp(status: number, bodyObj: unknown, headers: Record<string, string> = {}): ApiResponse {
  const body = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  const now = Date.now();
  return {
    id: 'resp-test-1',
    requestId: 'req-test-1',
    url: 'https://billing.test/invoices/1',
    method: 'GET',
    status,
    statusText: 'OK',
    ok: status >= 200 && status < 300,
    headers: { 'content-type': 'application/json', ...headers },
    body,
    rawBody: body,
    contentType: 'application/json',
    contentTypeCategory: 'json',
    size: body.length,
    sizeBytes: body.length,
    timeMs: 12,
    timing: {
      startTime: now - 12,
      endTime: now,
      duration: 12,
      prepareMs: 1,
      waitingMs: 8,
      downloadMs: 3,
    },
    receivedAt: new Date(now).toISOString(),
    timestamp: now,
    cookies: [],
    tests: [],
  };
}

describe('Phase 8: Contract Testing & API Spec Diff Engine', () => {
  it('validates OpenAPI nullable schemas, missing fields, type mismatches, unexpected properties, and required headers', () => {
    const parsed = parseOpenApiDocument(BASE_SPEC);
    const ep = parsed.endpoints[0];
    const req = createDefaultRequest('Fetch invoice', 'GET');

    // Valid nullable response with required header
    const validIssues = validateEndpointContract(
      ep,
      req,
      makeResp(200, { id: 'inv_1', amount: 120.5, customerNote: null }, { 'X-RateLimit': '100' }),
      parsed,
      true
    );
    expect(validIssues).toHaveLength(0);

    // Invalid: missing required field, wrong type, unexpected field, missing header
    const badIssues = validateEndpointContract(
      ep,
      req,
      makeResp(200, { id: 'inv_1', amount: 'not-a-number', extraKey: true }, {}),
      parsed,
      true
    );
    expect(badIssues.some((i) => i.issueType === 'missing-header')).toBe(true);
    expect(badIssues.some((i) => i.issueType === 'missing-property')).toBe(true);
    expect(badIssues.some((i) => i.issueType === 'type-mismatch')).toBe(true);
    expect(badIssues.some((i) => i.issueType === 'unexpected-property')).toBe(true);

    // Status mismatch
    const wrongStatus = validateEndpointContract(
      ep,
      req,
      makeResp(500, { message: 'boom' }, { 'X-RateLimit': '10' }),
      parsed
    );
    expect(wrongStatus.some((i) => i.issueType === 'status-mismatch')).toBe(true);
  });

  it('normalizes OpenAPI nullable properties cleanly for Ajv', () => {
    const norm = normalizeSchemaForAjv({
      type: 'object',
      properties: { note: { type: 'string', nullable: true } },
    });
    expect((norm.properties as any).note.type).toEqual(['string', 'null']);
    const errs = validateJsonAgainstContractSchema({ note: null }, norm);
    expect(errs).toHaveLength(0);
  });

  it('exports contract reports in JSON, CSV, and escaped HTML', () => {
    const report = {
      id: 'rep-1',
      specId: 'spec-1',
      specName: 'Billing <API>',
      baseUrl: 'https://billing.test',
      status: 'failed' as const,
      startedAt: 1000,
      completedAt: 1200,
      durationMs: 200,
      totalEndpoints: 1,
      passedCount: 0,
      failedCount: 1,
      results: [
        {
          id: 'r1',
          endpointId: 'ep1',
          method: 'GET' as const,
          path: '/invoices/1',
          requestUrl: 'https://billing.test/invoices/1',
          passed: false,
          statusCode: 500,
          expectedStatuses: ['200'],
          durationMs: 55,
          issues: [
            {
              id: 'i1',
              stage: 'response-status' as const,
              jsonPath: '$',
              issueType: 'status-mismatch' as const,
              message: 'Unexpected HTTP 500',
            },
          ],
        },
      ],
    };

    expect(JSON.parse(exportContractReportAsJson(report)).id).toBe('rep-1');
    const csv = exportContractReportAsCsv(report);
    expect(csv).toContain('GET,"/invoices/1"');
    expect(csv).toContain('FAIL');

    const html = exportContractReportAsHtml(report);
    expect(html).toContain('Billing &lt;API&gt;');
  });

  it('detects breaking, non-breaking endpoint additions, and heuristic disclaimers between API versions', () => {
    const baseVer: ApiVersionEntry = {
      id: 'v1',
      specId: 'spec-billing',
      versionLabel: '1.0.0',
      content: BASE_SPEC,
      format: 'yaml',
      isActive: false,
      isArchived: false,
      createdAt: 1,
      updatedAt: 1,
    };
    const targetVer: ApiVersionEntry = {
      id: 'v2',
      specId: 'spec-billing',
      versionLabel: '2.0.0',
      content: TARGET_SPEC,
      format: 'yaml',
      isActive: true,
      isArchived: false,
      createdAt: 2,
      updatedAt: 2,
    };

    const diff = compareApiSpecVersions(baseVer, targetVer);
    expect(diff.summary.removedEndpoints).toBe(1); // DELETE /invoices removed
    expect(diff.summary.addedEndpoints).toBe(1); // POST /invoices/export added
    expect(diff.summary.breaking).toBeGreaterThanOrEqual(2);
    expect(diff.disclaimer.toLowerCase()).toContain('rule-based');
    expect(diff.changes.some((c) => c.category === 'endpoint-removed' && c.severity === 'breaking')).toBe(true);
    expect(diff.changes.some((c) => c.category === 'endpoint-added' && c.severity === 'non-breaking')).toBe(true);
  });

  it('indexes createdAt on apiVersions and loads specs cleanly via useSpecStore', async () => {
    await db.open();
    await db.apiVersions.clear();
    await db.apiSpecs.clear();

    await db.apiSpecs.put({
      id: 'spec-idx-test',
      projectId: 'proj-default',
      workspaceId: 'ws-default',
      name: 'Indexed Billing API',
      version: '2.0.0',
      format: 'yaml',
      sourceType: 'manual',
      content: TARGET_SPEC,
      activeVersionId: 'ver-idx-2',
      createdAt: 100,
      updatedAt: 200,
    });

    await db.apiVersions.bulkPut([
      {
        id: 'ver-idx-1',
        specId: 'spec-idx-test',
        versionLabel: '1.0.0',
        content: BASE_SPEC,
        format: 'yaml',
        isActive: false,
        isArchived: false,
        createdAt: 100,
        updatedAt: 100,
      },
      {
        id: 'ver-idx-2',
        specId: 'spec-idx-test',
        versionLabel: '2.0.0',
        content: TARGET_SPEC,
        format: 'yaml',
        isActive: true,
        isArchived: false,
        createdAt: 200,
        updatedAt: 200,
      },
    ]);

    const ordered = await db.apiVersions.orderBy('createdAt').reverse().toArray();
    expect(ordered.map((v) => v.id)).toEqual(['ver-idx-2', 'ver-idx-1']);

    await useSpecStore.getState().loadSpecs();
    const state = useSpecStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.versions.map((v) => v.id)).toEqual(['ver-idx-2', 'ver-idx-1']);
  });
});
