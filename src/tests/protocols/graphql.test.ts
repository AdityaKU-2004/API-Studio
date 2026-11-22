import { describe, it, expect } from 'vitest';
import {
  buildGraphQLHttpRequest,
  parseGraphQLApiResponse,
} from '../../services/protocols/graphql/graphqlClient';
import {
  formatGraphQLQuery,
  validateGraphQLQuerySyntax,
  validateGraphQLVariables,
} from '../../services/protocols/graphql/graphqlFormatter';
import {
  formatGraphQLTypeRef,
  parseIntrospectionResult,
} from '../../services/protocols/graphql/graphqlIntrospection';
import { createDefaultRequest } from '../../stores/requestStore';
import { ApiResponse } from '../../types';

describe('Phase 6: GraphQL Client, Formatting, Variables & Introspection', () => {
  it('builds a GraphQL POST request with substituted variables and JSON body', () => {
    const base = { ...createDefaultRequest('User Query', 'POST'), requestType: 'graphql' as const };
    const built = buildGraphQLHttpRequest(
      base,
      {
        endpoint: '{{baseUrl}}/graphql',
        method: 'POST',
        query: 'query GetUser($id: ID!) { user(id: $id) { id name } }',
        variablesText: '{"id": "{{userId}}"}',
        operationName: 'GetUser',
        queryHistory: [],
      },
      { baseUrl: 'https://api.example.com', userId: '42' }
    );

    expect(built.validationError).toBeUndefined();
    expect(built.httpRequest?.method).toBe('POST');
    expect(built.httpRequest?.url).toBe('https://api.example.com/graphql');
    const payload = JSON.parse(built.httpRequest!.rawBody!);
    expect(payload.operationName).toBe('GetUser');
    expect(payload.variables).toEqual({ id: '42' });
    expect(payload.query).toContain('GetUser');
  });

  it('builds a GraphQL GET request with encoded query/variables parameters', () => {
    const base = { ...createDefaultRequest('User Query GET', 'GET'), requestType: 'graphql' as const };
    const built = buildGraphQLHttpRequest(
      base,
      {
        endpoint: 'https://api.example.com/graphql',
        method: 'GET',
        query: '{ viewer { id } }',
        variablesText: '{"limit": 10}',
        queryHistory: [],
      },
      {}
    );

    expect(built.httpRequest?.method).toBe('GET');
    expect(built.httpRequest?.params.some((p) => p.key === 'query' && p.value.includes('viewer'))).toBe(true);
    expect(built.httpRequest?.params.some((p) => p.key === 'variables' && p.value === '{"limit":10}')).toBe(true);
  });

  it('rejects invalid JSON variables before sending', () => {
    const base = { ...createDefaultRequest('Invalid Vars', 'POST'), requestType: 'graphql' as const };
    const built = buildGraphQLHttpRequest(
      base,
      {
        endpoint: 'https://api.example.com/graphql',
        method: 'POST',
        query: '{ hello }',
        variablesText: '{bad json}',
        queryHistory: [],
      },
      {}
    );

    expect(built.validationError).toBeDefined();
    expect(built.httpRequest).toBeUndefined();
  });

  it('surfaces GraphQL errors alongside partial data even when HTTP status is 200', () => {
    const rawBody = JSON.stringify({
      data: { viewer: null },
      errors: [
        {
          message: 'Field "viewer" unauthorized',
          locations: [{ line: 2, column: 3 }],
          path: ['viewer'],
          extensions: { code: 'UNAUTHENTICATED' },
        },
      ],
      extensions: { tracing: { version: 1 } },
    });

    const rawResp: ApiResponse = {
      id: 'resp-1',
      requestId: 'req-1',
      status: 200,
      statusText: 'OK',
      ok: true,
      url: 'https://api.example.com/graphql',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookies: [],
      tests: [],
      timeMs: 48,
      timing: {
        startTime: Date.now() - 48,
        endTime: Date.now(),
        duration: 48,
        prepareMs: 2,
        waitingMs: 40,
        downloadMs: 6,
      },
      size: 256,
      sizeBytes: 256,
      body: rawBody,
      rawBody,
      contentType: 'application/json',
      contentTypeCategory: 'json',
      receivedAt: new Date().toISOString(),
      timestamp: Date.now(),
    };

    const gqlResp = parseGraphQLApiResponse(rawResp);
    expect(gqlResp.httpStatus).toBe(200);
    expect(gqlResp.data).toEqual({ viewer: null });
    expect(gqlResp.errors).toHaveLength(1);
    expect(gqlResp.errors[0].extensions?.code).toBe('UNAUTHENTICATED');
    expect(gqlResp.errors[0].locations?.[0].line).toBe(2);
    expect(gqlResp.extensions).toEqual({ tracing: { version: 1 } });
  });

  it('validates GraphQL document brace syntax and formats query cleanly', () => {
    const validIssues = validateGraphQLQuerySyntax('query { users { id name } }');
    expect(validIssues).toHaveLength(0);

    const invalidIssues = validateGraphQLQuerySyntax('query { users { id ');
    expect(invalidIssues.length).toBeGreaterThan(0);
    expect(invalidIssues[0].message).toMatch(/closing brace/i);

    const formatted = formatGraphQLQuery('query { users { id name } }');
    expect(formatted).toContain('\n');

    const varsCheck = validateGraphQLVariables('["not-an-object"]');
    expect(varsCheck.valid).toBe(false);
  });

  it('parses GraphQL introspection schema and formats type references', () => {
    const schema = parseIntrospectionResult('https://api.example.com/graphql', {
      __schema: {
        queryType: { name: 'Query' },
        mutationType: { name: 'Mutation' },
        types: [
          { kind: 'OBJECT', name: '__Schema' },
          {
            kind: 'OBJECT',
            name: 'Query',
            fields: [
              {
                name: 'users',
                args: [],
                type: {
                  kind: 'NON_NULL',
                  ofType: { kind: 'LIST', ofType: { kind: 'OBJECT', name: 'User' } },
                },
              },
            ],
          },
        ],
      },
    });

    expect(schema).not.toBeNull();
    expect(schema!.queryTypeName).toBe('Query');
    expect(schema!.types).toHaveLength(1);
    expect(formatGraphQLTypeRef(schema!.types[0].fields![0].type)).toBe('[User]!');
  });
});
