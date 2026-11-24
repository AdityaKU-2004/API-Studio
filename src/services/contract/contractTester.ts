import Ajv from 'ajv';
import {
  ApiRequest,
  ApiResponse,
  ContractEndpointResult,
  ContractTestReport,
  ContractValidationIssue,
  OpenApiEndpointItem,
  OpenApiParsedDoc,
} from '../../types';
import { httpClient } from '../http/httpClient';
import { generateRequestFromEndpoint, resolveSchemaRefs } from '../openapi/openapiParser';
import { escapeHtml } from '../documentation/docGenerator';

const ajv = new Ajv({ allErrors: true, strict: false });

export function normalizeSchemaForAjv(
  schema: Record<string, unknown>,
  rootDoc?: Record<string, unknown>
): Record<string, unknown> {
  const resolved = rootDoc ? resolveSchemaRefs(schema, rootDoc) || schema : { ...schema };

  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(walk);
    const obj = { ...(node as Record<string, unknown>) };

    // OpenAPI 3.0 `nullable: true` conversion
    if (obj.nullable === true) {
      if (typeof obj.type === 'string') {
        obj.type = [obj.type, 'null'];
      }
      delete obj.nullable;
    }

    if (obj.properties && typeof obj.properties === 'object') {
      const nextProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj.properties as Record<string, unknown>)) {
        nextProps[k] = walk(v);
      }
      obj.properties = nextProps;
    }
    if (obj.items) {
      obj.items = walk(obj.items);
    }
    return obj;
  };

  return walk(resolved) as Record<string, unknown>;
}

export function validateJsonAgainstContractSchema(
  data: unknown,
  schema: Record<string, unknown>,
  rootDoc?: Record<string, unknown>,
  stage: ContractValidationIssue['stage'] = 'response-body',
  strictNoAdditionalProperties = false
): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];
  const normalizedSchema = normalizeSchemaForAjv(schema, rootDoc);
  if (strictNoAdditionalProperties && normalizedSchema.type === 'object') {
    normalizedSchema.additionalProperties = false;
  }

  try {
    const validate = ajv.compile(normalizedSchema);
    const valid = validate(data);
    if (!valid && validate.errors) {
      for (const err of validate.errors) {
        let issueType: ContractValidationIssue['issueType'] = 'schema-violation';
        if (err.keyword === 'required') issueType = 'missing-property';
        else if (err.keyword === 'type') issueType = 'type-mismatch';
        else if (err.keyword === 'additionalProperties') issueType = 'unexpected-property';

        issues.push({
          id: `cissue-${issues.length + 1}`,
          stage,
          jsonPath: err.instancePath || '$',
          issueType,
          message: `${err.instancePath || '$'} ${err.message || 'failed schema validation'}`,
          expected: err.params ? JSON.stringify(err.params) : undefined,
          actual:
            err.keyword === 'type'
              ? typeof data
              : err.keyword === 'additionalProperties'
                ? String((err.params as Record<string, unknown>)?.additionalProperty || '')
                : undefined,
        });
      }
    }
  } catch (err) {
    issues.push({
      id: `cissue-${issues.length + 1}`,
      stage,
      jsonPath: '$',
      issueType: 'schema-violation',
      message: `Schema compilation error: ${(err as Error).message}`,
    });
  }

  return issues;
}

export function validateEndpointContract(
  endpoint: OpenApiEndpointItem,
  request: ApiRequest,
  response: ApiResponse,
  parsedDoc: OpenApiParsedDoc,
  strictNoAdditionalProperties = false
): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];

  // 1. Validate request parameters & body
  for (const param of endpoint.parameters.filter((p) => p.required && p.in === 'query')) {
    const matched = request.params.find((rp) => rp.enabled && rp.key === param.name && rp.value !== '');
    if (!matched) {
      issues.push({
        id: `cissue-${issues.length + 1}`,
        stage: 'request',
        jsonPath: `$.query.${param.name}`,
        issueType: 'missing-property',
        message: `Missing required query parameter "${param.name}".`,
        expected: 'non-empty value',
      });
    }
  }

  if (endpoint.requestBody?.required && endpoint.requestBody.schema) {
    const rawBody = request.body?.rawContent?.json ?? request.rawBody ?? '';
    if (!rawBody.trim()) {
      issues.push({
        id: `cissue-${issues.length + 1}`,
        stage: 'request',
        jsonPath: '$',
        issueType: 'missing-property',
        message: 'Required JSON request body is empty.',
      });
    } else {
      try {
        const parsedReqBody = JSON.parse(rawBody);
        issues.push(
          ...validateJsonAgainstContractSchema(
            parsedReqBody,
            endpoint.requestBody.schema,
            parsedDoc.normalizedDocument,
            'request',
            strictNoAdditionalProperties
          )
        );
      } catch {
        issues.push({
          id: `cissue-${issues.length + 1}`,
          stage: 'request',
          jsonPath: '$',
          issueType: 'schema-violation',
          message: 'Request body is not valid JSON.',
        });
      }
    }
  }

  // 2. Validate response status code
  const statusStr = String(response.status);
  const matchingResp =
    endpoint.responses.find((r) => r.statusCode === statusStr) ||
    endpoint.responses.find((r) => r.statusCode === `${statusStr[0]}XX`) ||
    endpoint.responses.find((r) => r.statusCode === 'default');

  if (!matchingResp) {
    issues.push({
      id: `cissue-${issues.length + 1}`,
      stage: 'response-status',
      jsonPath: '$.status',
      issueType: 'status-mismatch',
      message: `Unexpected HTTP status ${statusStr}. Expected one of: ${
        endpoint.responses.map((r) => r.statusCode).join(', ') || 'none'
      }`,
      expected: endpoint.responses.map((r) => r.statusCode).join(', '),
      actual: statusStr,
    });
    return issues;
  }

  // 3. Validate response headers if specified
  if (matchingResp.headers) {
    const respHeadersLower = new Map<string, string>(
      Object.entries(response.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
    for (const [hdrName, hdrSpec] of Object.entries(matchingResp.headers)) {
      const hdrRequired = (hdrSpec as Record<string, unknown>)?.required === true;
      if (hdrRequired && !respHeadersLower.has(hdrName.toLowerCase())) {
        issues.push({
          id: `cissue-${issues.length + 1}`,
          stage: 'response-headers',
          jsonPath: `$.headers.${hdrName}`,
          issueType: 'missing-header',
          message: `Missing required response header "${hdrName}".`,
          expected: hdrName,
        });
      }
    }
  }

  // 4. Validate response JSON body against schema
  if (matchingResp.schema) {
    const rawBodyText = response.body || response.rawBody || '';
    if (!rawBodyText.trim()) {
      issues.push({
        id: `cissue-${issues.length + 1}`,
        stage: 'response-body',
        jsonPath: '$',
        issueType: 'schema-violation',
        message: 'Expected JSON response body according to OpenAPI contract, but body was empty.',
      });
    } else {
      try {
        const bodyJson = JSON.parse(rawBodyText);
        issues.push(
          ...validateJsonAgainstContractSchema(
            bodyJson,
            matchingResp.schema,
            parsedDoc.normalizedDocument,
            'response-body',
            strictNoAdditionalProperties
          )
        );
      } catch {
        issues.push({
          id: `cissue-${issues.length + 1}`,
          stage: 'response-body',
          jsonPath: '$',
          issueType: 'schema-violation',
          message: 'Response body is not valid JSON for schema contract validation.',
        });
      }
    }
  }

  return issues;
}

export async function runContractTestSuite(params: {
  specId: string;
  parsedDoc: OpenApiParsedDoc;
  baseUrl: string;
  environmentName?: string;
  resolvedVariables?: Record<string, string>;
  endpointIds?: string[];
  strictNoAdditionalProperties?: boolean;
  shouldStop?: () => boolean;
  onProgress?: (result: ContractEndpointResult, index: number, total: number) => void;
}): Promise<ContractTestReport> {
  const startedAt = Date.now();
  const endpoints = params.endpointIds?.length
    ? params.parsedDoc.endpoints.filter((e) => params.endpointIds!.includes(e.id))
    : params.parsedDoc.endpoints;

  const results: ContractEndpointResult[] = [];
  let stopped = false;

  for (let i = 0; i < endpoints.length; i++) {
    if (params.shouldStop?.()) {
      stopped = true;
      break;
    }

    const ep = endpoints[i];
    const req = generateRequestFromEndpoint(ep, {
      baseUrl: params.baseUrl,
      parsedDoc: params.parsedDoc,
    });
    const epStart = Date.now();
    let issues: ContractValidationIssue[] = [];
    let statusCode: number | undefined;

    try {
      const resp = await httpClient.execute(req, {
        resolvedVariables: params.resolvedVariables,
      });
      statusCode = resp.status;
      if (resp.error) {
        issues.push({
          id: 'cissue-exec',
          stage: 'response-status',
          jsonPath: '$',
          issueType: 'execution-error',
          message: resp.error.message || 'HTTP execution failed.',
        });
      } else {
        issues = validateEndpointContract(
          ep,
          req,
          resp,
          params.parsedDoc,
          params.strictNoAdditionalProperties
        );
      }
    } catch (err) {
      issues.push({
        id: 'cissue-err',
        stage: 'response-status',
        jsonPath: '$',
        issueType: 'execution-error',
        message: err instanceof Error ? err.message : 'Contract test execution failed.',
      });
    }

    const result: ContractEndpointResult = {
      id: `cres-${i + 1}`,
      endpointId: ep.id,
      method: ep.method,
      path: ep.path,
      requestUrl: req.url,
      requestId: req.id,
      passed: issues.length === 0,
      statusCode,
      expectedStatuses: ep.responses.map((r) => r.statusCode),
      durationMs: Date.now() - epStart,
      issues,
    };

    results.push(result);
    params.onProgress?.(result, i + 1, endpoints.length);
  }

  const completedAt = Date.now();
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    id: `creport-${completedAt}`,
    specId: params.specId,
    specName: params.parsedDoc.title,
    environmentName: params.environmentName,
    baseUrl: params.baseUrl,
    status: stopped ? 'stopped' : failedCount === 0 ? 'passed' : 'failed',
    startedAt,
    completedAt,
    durationMs: completedAt - startedAt,
    totalEndpoints: endpoints.length,
    passedCount,
    failedCount,
    results,
  };
}

export function exportContractReportAsJson(report: ContractTestReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportContractReportAsCsv(report: ContractTestReport): string {
  const header = 'Method,Path,Request URL,Passed,Status Code,Expected Statuses,Duration (ms),Issues';
  const rows = report.results.map((r) => {
    const issueText = r.issues.map((i) => `[${i.stage}] ${i.jsonPath}: ${i.message}`).join(' | ');
    return [
      r.method,
      `"${r.path.replace(/"/g, '""')}"`,
      `"${r.requestUrl.replace(/"/g, '""')}"`,
      r.passed ? 'PASS' : 'FAIL',
      r.statusCode ?? '',
      `"${r.expectedStatuses.join(';')}"`,
      r.durationMs,
      `"${issueText.replace(/"/g, '""')}"`,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export function exportContractReportAsHtml(report: ContractTestReport): string {
  const rows = report.results
    .map(
      (r) => `<tr>
        <td><code>${escapeHtml(r.method)}</code></td>
        <td><code>${escapeHtml(r.path)}</code></td>
        <td>${r.passed ? '<span style="color:#10b981">PASS</span>' : '<span style="color:#ef4444">FAIL</span>'}</td>
        <td>${r.statusCode ?? 'ERR'}</td>
        <td>${r.durationMs}ms</td>
        <td>${r.issues.map((i) => `<div><strong>${escapeHtml(i.jsonPath)}</strong>: ${escapeHtml(i.message)}</div>`).join('') || 'OK'}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Contract Report - ${escapeHtml(
    report.specName
  )}</title>
<style>body{font-family:sans-serif;background:#0b0f17;color:#e2e8f0;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #1e293b;padding:8px;text-align:left;font-size:13px}</style>
</head><body>
<h1>Contract Test Report: ${escapeHtml(report.specName)}</h1>
<p>Base URL: <code>${escapeHtml(report.baseUrl)}</code> · Passed: ${report.passedCount}/${
    report.results.length
  }</p>
<table><thead><tr><th>Method</th><th>Path</th><th>Result</th><th>Status</th><th>Duration</th><th>Issues</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
}
