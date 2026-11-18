import { describe, it, expect } from 'vitest';
import { assertionEngine } from '../../services/testing/assertionEngine';
import { schemaValidator } from '../../services/testing/schemaValidator';
import { ApiResponse, AssertionRule } from '../../types';

function makeMockResponse(overrides: Partial<ApiResponse> = {}): ApiResponse {
  const defaultBody = JSON.stringify({
    success: true,
    user: { id: 42, email: 'ada@acme.io', tags: ['admin', 'core'] },
    items: [10, 20, 30],
  });
  return {
    id: 'res-1',
    requestId: 'req-1',
    status: 200,
    statusText: 'OK',
    ok: true,
    url: 'https://api.example.com/profile',
    method: 'GET',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Trace-Id': 'tr-999' },
    body: defaultBody,
    rawBody: defaultBody,
    contentType: 'application/json; charset=utf-8',
    contentTypeCategory: 'json',
    size: defaultBody.length,
    sizeBytes: defaultBody.length,
    timeMs: 120,
    timing: { startTime: 0, endTime: 120, duration: 120, prepareMs: 1, waitingMs: 115, downloadMs: 4 },
    receivedAt: new Date().toISOString(),
    timestamp: Date.now(),
    cookies: [],
    tests: [],
    ...overrides,
  };
}

describe('Phase 5: Automated Assertions & JSON Schema Validation', () => {
  it('17. evaluates status code assertions (equals, notEquals, between, 2xx/4xx/5xx)', () => {
    const resp200 = makeMockResponse({ status: 200 });
    const resp404 = makeMockResponse({ status: 404 });

    const rules: AssertionRule[] = [
      { id: '1', name: 'Status is 200', enabled: true, order: 1, category: 'status', operator: 'equals', expectedValue: '200' },
      { id: '2', name: 'Status is 2xx', enabled: true, order: 2, category: 'status', operator: 'is2xx' },
      { id: '3', name: 'Status 200..299', enabled: true, order: 3, category: 'status', operator: 'between', expectedValue: '200', expectedValueMax: '299' },
      { id: '4', name: 'Not 500', enabled: true, order: 4, category: 'status', operator: 'notEquals', expectedValue: '500' },
    ];

    expect(assertionEngine.evaluate(rules, resp200).allPassed).toBe(true);
    expect(assertionEngine.evaluate([{ ...rules[1], id: 'f1' }], resp404).failed).toBe(1);
    expect(
      assertionEngine.evaluate(
        [{ id: '5', name: 'Is 4xx', enabled: true, order: 1, category: 'status', operator: 'is4xx' }],
        resp404
      ).allPassed
    ).toBe(true);
  });

  it('18. evaluates JSON body path assertions (exists, equals, contains, arrayLength, arrayContains, isType)', () => {
    const resp = makeMockResponse();
    const rules: AssertionRule[] = [
      { id: 'b1', name: 'email exists', enabled: true, order: 1, category: 'body', target: 'user.email', operator: 'exists' },
      { id: 'b2', name: 'email equals', enabled: true, order: 2, category: 'body', target: 'user.email', operator: 'equals', expectedValue: 'ada@acme.io' },
      { id: 'b3', name: 'tags contains', enabled: true, order: 3, category: 'body', target: 'user.tags', operator: 'arrayContains', expectedValue: 'admin' },
      { id: 'b4', name: 'items length 3', enabled: true, order: 4, category: 'body', target: 'items', operator: 'arrayLength', expectedValue: '3' },
      { id: 'b5', name: 'id is number', enabled: true, order: 5, category: 'body', target: 'user.id', operator: 'isType', expectedValue: 'number' },
      { id: 'b6', name: 'missing absent', enabled: true, order: 6, category: 'body', target: 'user.secret', operator: 'notExists' },
    ];

    const summary = assertionEngine.evaluate(rules, resp);
    expect(summary.allPassed).toBe(true);
    expect(summary.passed).toBe(6);
  });

  it('19. evaluates response header (case-insensitive) and content-type assertions', () => {
    const resp = makeMockResponse();
    const rules: AssertionRule[] = [
      { id: 'h1', name: 'has trace', enabled: true, order: 1, category: 'headers', target: 'x-trace-id', operator: 'equals', expectedValue: 'tr-999' },
      { id: 'h2', name: 'is json', enabled: true, order: 2, category: 'contentType', operator: 'contains', expectedValue: 'application/json' },
    ];

    const summary = assertionEngine.evaluate(rules, resp);
    expect(summary.allPassed).toBe(true);
  });

  it('20. evaluates response time assertions and marks disabled rules as skipped', () => {
    const resp = makeMockResponse({ timeMs: 120 });
    const rules: AssertionRule[] = [
      { id: 't1', name: 'under 300ms', enabled: true, order: 1, category: 'responseTime', operator: 'lessThan', expectedValue: '300' },
      { id: 't2', name: 'disabled rule', enabled: false, order: 2, category: 'responseTime', operator: 'lessThan', expectedValue: '10' },
    ];
    const summary = assertionEngine.evaluate(rules, resp);
    expect(summary.passed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('21. validates valid response payload against JSON Schema via Ajv', () => {
    const resp = makeMockResponse();
    const schema = JSON.stringify({
      type: 'object',
      required: ['success', 'user', 'items'],
      properties: {
        success: { type: 'boolean' },
        user: {
          type: 'object',
          required: ['id', 'email'],
          properties: {
            id: { type: 'number', minimum: 1 },
            email: { type: 'string', minLength: 3 },
          },
        },
        items: { type: 'array', minItems: 2 },
      },
    });
    const res = schemaValidator.validateResponse(resp, schema, 'ProfileSchema');
    expect(res.valid).toBe(true);
    expect(res.errorCount).toBe(0);
  });

  it('22. reports detailed JSON Schema validation errors and handles invalid schema syntax', () => {
    const resp = makeMockResponse({
      body: JSON.stringify({ success: 'yes', user: { id: 'not-a-num' } }),
    });
    const schema = JSON.stringify({
      type: 'object',
      required: ['success', 'user', 'items'],
      properties: {
        success: { type: 'boolean' },
        user: {
          type: 'object',
          properties: { id: { type: 'number' } },
        },
      },
    });

    const failRes = schemaValidator.validateResponse(resp, schema);
    expect(failRes.valid).toBe(false);
    expect(failRes.errorCount).toBeGreaterThanOrEqual(3);
    expect(failRes.errors.some((e) => e.path.includes('user.id'))).toBe(true);

    const badSchemaRes = schemaValidator.validateResponse(resp, '{ invalid json');
    expect(badSchemaRes.valid).toBe(false);
    expect(badSchemaRes.schemaSyntaxError).toBeDefined();
  });
});
