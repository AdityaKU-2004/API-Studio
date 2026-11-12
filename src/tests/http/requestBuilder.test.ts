import { describe, it, expect } from 'vitest';
import { buildExecutableRequest } from '../../services/http/requestBuilder';
import { ApiRequest } from '../../types';
import { createDefaultRequest } from '../../stores/requestStore';

describe('requestBuilder', () => {
  const baseMockRequest: ApiRequest = {
    ...createDefaultRequest('Test Request', 'GET'),
    id: 'test-req-1',
    url: 'https://api.example.com/items',
    params: [],
    headers: [],
    auth: { type: 'none' },
  };

  it('1. builds a standard GET request with clean options', () => {
    const result = buildExecutableRequest(baseMockRequest);
    expect(result.validationError).toBeUndefined();
    expect(result.fetchUrl).toBe('https://api.example.com/items');
    expect(result.fetchOptions.method).toBe('GET');
    expect(result.fetchOptions.body).toBeUndefined();
  });

  it('2. builds a POST request with JSON body and auto Content-Type', () => {
    const postReq: ApiRequest = {
      ...baseMockRequest,
      method: 'POST',
      body: {
        ...baseMockRequest.body,
        mode: 'json',
        rawContent: { json: '{"name":"Widget","price":99}' },
      },
    };

    const result = buildExecutableRequest(postReq);
    expect(result.validationError).toBeUndefined();
    expect(result.fetchOptions.method).toBe('POST');
    expect(result.fetchOptions.body).toBe('{"name":"Widget","price":99}');
    expect((result.fetchOptions.headers as any)['Content-Type']).toBe('application/json');
  });

  it('3. rejects malformed JSON with descriptive validation error', () => {
    const malformedReq: ApiRequest = {
      ...baseMockRequest,
      method: 'POST',
      body: {
        ...baseMockRequest.body,
        mode: 'json',
        rawContent: { json: '{ name: unquoted }' },
      },
    };

    const result = buildExecutableRequest(malformedReq);
    expect(result.validationError).toBeDefined();
    expect(result.validationError).toContain('JSON Syntax Error');
  });

  it('4. builds PUT, PATCH, and DELETE requests properly', () => {
    for (const m of ['PUT', 'PATCH', 'DELETE'] as const) {
      const req: ApiRequest = {
        ...baseMockRequest,
        method: m,
        body: { ...baseMockRequest.body, mode: 'text', rawContent: { text: 'custom body' } },
      };
      const res = buildExecutableRequest(req);
      expect(res.fetchOptions.method).toBe(m);
      expect(res.fetchOptions.body).toBe('custom body');
    }
  });

  it('5. omits body for HEAD and OPTIONS methods according to HTTP standards', () => {
    const headReq: ApiRequest = {
      ...baseMockRequest,
      method: 'HEAD',
      body: { ...baseMockRequest.body, mode: 'json', rawContent: { json: '{"should":"ignore"}' } },
    };
    const res = buildExecutableRequest(headReq);
    expect(res.fetchOptions.body).toBeUndefined();
  });

  it('6. appends enabled query parameters with encoding and supports duplicate keys', () => {
    const req: ApiRequest = {
      ...baseMockRequest,
      url: 'https://api.example.com/search?fixed=1',
      params: [
        { id: '1', key: 'tag', value: 'react', description: '', enabled: true },
        { id: '2', key: 'tag', value: 'typescript', description: '', enabled: true },
        { id: '3', key: 'query', value: 'hello world', description: '', enabled: true },
        { id: '4', key: 'disabled', value: 'skip', description: '', enabled: false },
      ],
    };

    const res = buildExecutableRequest(req);
    expect(res.fetchUrl).toContain('fixed=1');
    expect(res.fetchUrl).toContain('tag=react');
    expect(res.fetchUrl).toContain('tag=typescript');
    expect(res.fetchUrl).toContain('query=hello+world');
    expect(res.fetchUrl).not.toContain('disabled=skip');
  });

  it('7. resolves environment variables in URL, headers, and body', () => {
    const req: ApiRequest = {
      ...baseMockRequest,
      method: 'POST',
      url: '{{base_url}}/users',
      headers: [{ id: 'h1', key: 'X-Tenant-ID', value: '{{tenant}}', description: '', enabled: true }],
      body: { ...baseMockRequest.body, mode: 'json', rawContent: { json: '{"org":"{{tenant}}"}' } },
    };

    const vars = { base_url: 'https://staging.acme.io', tenant: 'tenant-42' };
    const res = buildExecutableRequest(req, { resolvedVariables: vars });

    expect(res.fetchUrl).toBe('https://staging.acme.io/users');
    expect((res.fetchOptions.headers as any)['X-Tenant-ID']).toBe('tenant-42');
    expect(res.fetchOptions.body).toBe('{"org":"tenant-42"}');
  });

  it('8. applies Bearer Token authorization header', () => {
    const req: ApiRequest = {
      ...baseMockRequest,
      auth: {
        type: 'bearer',
        bearer: { token: 'jwt-token-secret-123', prefix: 'Bearer' },
      },
    };

    const res = buildExecutableRequest(req);
    expect((res.fetchOptions.headers as any)['Authorization']).toBe('Bearer jwt-token-secret-123');
  });

  it('9. applies Basic Authentication header with base64 encoding', () => {
    const req: ApiRequest = {
      ...baseMockRequest,
      auth: {
        type: 'basic',
        basic: { username: 'admin', password: 'secretpassword' },
      },
    };

    const res = buildExecutableRequest(req);
    const expected = 'Basic ' + btoa('admin:secretpassword');
    expect((res.fetchOptions.headers as any)['Authorization']).toBe(expected);
  });

  it('10. applies API Key authorization in Header or Query Parameter', () => {
    // Header
    const reqHeader: ApiRequest = {
      ...baseMockRequest,
      auth: {
        type: 'apikey',
        apikey: { key: 'X-API-KEY', value: 'key-999', addTo: 'header', enabled: true },
      },
    };
    const resHeader = buildExecutableRequest(reqHeader);
    expect((resHeader.fetchOptions.headers as any)['X-API-KEY']).toBe('key-999');

    // Query
    const reqQuery: ApiRequest = {
      ...baseMockRequest,
      auth: {
        type: 'apikey',
        apikey: { key: 'api_key', value: 'key-999', addTo: 'query', enabled: true },
      },
    };
    const resQuery = buildExecutableRequest(reqQuery);
    expect(resQuery.fetchUrl).toContain('api_key=key-999');
  });

  it('11. does NOT set multipart boundary manually for FormData', () => {
    const req: ApiRequest = {
      ...baseMockRequest,
      method: 'POST',
      headers: [{ id: '1', key: 'Content-Type', value: 'multipart/form-data', description: '', enabled: true }],
      body: {
        ...baseMockRequest.body,
        mode: 'form-data',
        formData: [
          { id: '1', key: 'username', value: 'alex', type: 'text', enabled: true },
        ],
      },
    };

    const res = buildExecutableRequest(req);
    expect(res.fetchOptions.body instanceof FormData).toBe(true);
    expect((res.fetchOptions.headers as any)['Content-Type']).toBeUndefined();
  });

  it('12. builds URL Encoded body with URLSearchParams', () => {
    const req: ApiRequest = {
      ...baseMockRequest,
      method: 'POST',
      body: {
        ...baseMockRequest.body,
        mode: 'x-www-form-urlencoded',
        urlEncoded: [
          { id: '1', key: 'grant_type', value: 'password', description: '', enabled: true },
          { id: '2', key: 'scope', value: 'read write', description: '', enabled: true },
        ],
      },
    };

    const res = buildExecutableRequest(req);
    expect(res.fetchOptions.body instanceof URLSearchParams).toBe(true);
    expect((res.fetchOptions.headers as any)['Content-Type']).toContain('application/x-www-form-urlencoded');
    expect((res.fetchOptions.body as URLSearchParams).get('grant_type')).toBe('password');
  });
});
