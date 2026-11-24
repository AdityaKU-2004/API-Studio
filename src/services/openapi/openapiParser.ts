import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import {
  ApiRequest,
  HttpMethod,
  KeyValueItem,
  OpenApiEndpointItem,
  OpenApiParameter,
  OpenApiParsedDoc,
  OpenApiRequestBodySpec,
  OpenApiResponseSpec,
  OpenApiSecuritySchemeEntry,
  OpenApiSpecFormat,
  OpenApiVersionKind,
} from '../../types';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function detectSpecFormat(raw: string): OpenApiSpecFormat {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  return 'yaml';
}

export function parseRawSpecObject(raw: string): {
  doc: Record<string, unknown>;
  format: OpenApiSpecFormat;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Specification content is empty.');
  }

  const format = detectSpecFormat(trimmed);
  let parsed: unknown;
  if (format === 'json') {
    parsed = JSON.parse(trimmed);
  } else {
    parsed = yamlLoad(trimmed);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenAPI / Swagger document must parse to a JSON/YAML object.');
  }

  return { doc: parsed as Record<string, unknown>, format };
}

export function serializeSpecObject(
  doc: Record<string, unknown>,
  format: OpenApiSpecFormat
): string {
  if (format === 'json') {
    return JSON.stringify(doc, null, 2);
  }
  return yamlDump(doc, { noRefs: true, lineWidth: 100 });
}

export function resolveJsonPointer(
  root: Record<string, unknown>,
  ref: string
): Record<string, unknown> | undefined {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref
    .slice(2)
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current && typeof current === 'object' && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : undefined;
}

export function resolveSchemaRefs(
  schema: unknown,
  root: Record<string, unknown>,
  visited: Set<string> = new Set(),
  depth = 0
): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== 'object' || depth > 20) return undefined;
  const obj = schema as Record<string, unknown>;

  if (typeof obj.$ref === 'string') {
    const ref = obj.$ref;
    if (visited.has(ref)) {
      return { type: 'object', description: `Circular reference (${ref})` };
    }
    const target = resolveJsonPointer(root, ref);
    if (!target) {
      return { type: 'object', description: `Unresolved ref (${ref})` };
    }
    const nextVisited = new Set(visited);
    nextVisited.add(ref);
    const resolvedTarget = resolveSchemaRefs(target, root, nextVisited, depth + 1) || {};
    const { $ref: _ignored, ...rest } = obj;
    return { ...resolvedTarget, ...rest };
  }

  const out: Record<string, unknown> = { ...obj };
  if (obj.properties && typeof obj.properties === 'object') {
    const resolvedProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj.properties as Record<string, unknown>)) {
      resolvedProps[k] = resolveSchemaRefs(v, root, visited, depth + 1) || v;
    }
    out.properties = resolvedProps;
  }
  if (obj.items) {
    out.items = Array.isArray(obj.items)
      ? obj.items.map((item) => resolveSchemaRefs(item, root, visited, depth + 1) || item)
      : resolveSchemaRefs(obj.items, root, visited, depth + 1) || obj.items;
  }
  for (const combiner of ['allOf', 'anyOf', 'oneOf']) {
    if (Array.isArray(obj[combiner])) {
      out[combiner] = (obj[combiner] as unknown[]).map(
        (sub) => resolveSchemaRefs(sub, root, visited, depth + 1) || sub
      );
    }
  }
  return out;
}

export function generateSampleFromSchema(
  schema: Record<string, unknown> | undefined,
  root: Record<string, unknown>,
  depth = 0
): unknown {
  if (!schema || depth > 8) return {};
  const resolved = resolveSchemaRefs(schema, root) || schema;

  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) return resolved.enum[0];

  if (Array.isArray(resolved.allOf) && resolved.allOf.length > 0) {
    const merged: Record<string, unknown> = {};
    for (const sub of resolved.allOf) {
      const val = generateSampleFromSchema(sub as Record<string, unknown>, root, depth + 1);
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(merged, val);
      }
    }
    return merged;
  }

  if (Array.isArray(resolved.oneOf) && resolved.oneOf.length > 0) {
    return generateSampleFromSchema(resolved.oneOf[0] as Record<string, unknown>, root, depth + 1);
  }
  if (Array.isArray(resolved.anyOf) && resolved.anyOf.length > 0) {
    return generateSampleFromSchema(resolved.anyOf[0] as Record<string, unknown>, root, depth + 1);
  }

  const rawType = Array.isArray(resolved.type) ? resolved.type[0] : resolved.type;
  const schemaType =
    typeof rawType === 'string'
      ? rawType
      : resolved.properties
        ? 'object'
        : resolved.items
          ? 'array'
          : 'string';

  switch (schemaType) {
    case 'object': {
      const obj: Record<string, unknown> = {};
      const props = (resolved.properties || {}) as Record<string, Record<string, unknown>>;
      for (const [k, propSchema] of Object.entries(props)) {
        obj[k] = generateSampleFromSchema(propSchema, root, depth + 1);
      }
      return obj;
    }
    case 'array': {
      const itemSample = generateSampleFromSchema(
        resolved.items as Record<string, unknown> | undefined,
        root,
        depth + 1
      );
      return [itemSample];
    }
    case 'integer':
      return 1;
    case 'number':
      return 1.5;
    case 'boolean':
      return true;
    case 'string':
    default: {
      if (resolved.format === 'email') return 'user@example.com';
      if (resolved.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
      if (resolved.format === 'date-time') return '2026-01-01T00:00:00Z';
      if (resolved.format === 'date') return '2026-01-01';
      if (resolved.format === 'uri' || resolved.format === 'url') return 'https://example.com';
      return 'string';
    }
  }
}

export function detectSpecVersionKind(doc: Record<string, unknown>): OpenApiVersionKind {
  if (typeof doc.openapi === 'string') {
    if (doc.openapi.startsWith('3.1')) return 'openapi-3.1';
    if (doc.openapi.startsWith('3.')) return 'openapi-3.0';
  }
  if (typeof doc.swagger === 'string' && doc.swagger.startsWith('2.')) {
    return 'swagger-2.0';
  }
  return 'unknown';
}

function normalizeSwagger2ToOpenApi3(doc: Record<string, unknown>): Record<string, unknown> {
  const host = typeof doc.host === 'string' && doc.host.trim() ? doc.host.trim() : 'api.example.com';
  const basePath = typeof doc.basePath === 'string' ? doc.basePath : '';
  const schemes = Array.isArray(doc.schemes) && doc.schemes.length > 0 ? doc.schemes : ['https'];
  const servers = schemes.map((scheme) => ({
    url: `${String(scheme)}://${host}${basePath === '/' ? '' : basePath}`,
  }));

  const definitions =
    doc.definitions && typeof doc.definitions === 'object' ? doc.definitions : {};
  const securityDefinitions =
    doc.securityDefinitions && typeof doc.securityDefinitions === 'object'
      ? doc.securityDefinitions
      : {};

  // Deep replace #/definitions/ -> #/components/schemas/
  const serialized = JSON.stringify(doc).replaceAll('#/definitions/', '#/components/schemas/');
  const cloned = JSON.parse(serialized) as Record<string, unknown>;

  const rawPaths = (cloned.paths || {}) as Record<string, Record<string, unknown>>;
  const normalizedPaths: Record<string, Record<string, unknown>> = {};

  for (const [pathKey, pathItem] of Object.entries(rawPaths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const nextPathItem: Record<string, unknown> = {};
    for (const [key, opVal] of Object.entries(pathItem)) {
      const upper = key.toUpperCase() as HttpMethod;
      if (!HTTP_METHODS.includes(upper) || !opVal || typeof opVal !== 'object') {
        nextPathItem[key] = opVal;
        continue;
      }
      const op = { ...(opVal as Record<string, unknown>) };
      const params = Array.isArray(op.parameters)
        ? (op.parameters as Array<Record<string, unknown>>)
        : [];
      const bodyParam = params.find((p) => p.in === 'body');
      const formParams = params.filter((p) => p.in === 'formData');
      const remainingParams = params.filter((p) => p.in !== 'body' && p.in !== 'formData');

      op.parameters = remainingParams;
      if (bodyParam && bodyParam.schema) {
        op.requestBody = {
          required: Boolean(bodyParam.required),
          description: bodyParam.description,
          content: {
            'application/json': {
              schema: bodyParam.schema,
            },
          },
        };
      } else if (formParams.length > 0) {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];
        for (const fp of formParams) {
          const name = String(fp.name || 'field');
          properties[name] = { type: fp.type || 'string', description: fp.description };
          if (fp.required) required.push(name);
        }
        op.requestBody = {
          content: {
            'application/x-www-form-urlencoded': {
              schema: { type: 'object', properties, required },
            },
          },
        };
      }

      const rawResponses = (op.responses || {}) as Record<string, Record<string, unknown>>;
      const normalizedResponses: Record<string, Record<string, unknown>> = {};
      for (const [statusCode, resp] of Object.entries(rawResponses)) {
        if (!resp || typeof resp !== 'object') continue;
        if (resp.schema) {
          normalizedResponses[statusCode] = {
            description: resp.description || '',
            headers: resp.headers,
            content: {
              'application/json': {
                schema: resp.schema,
                ...(resp.examples ? { example: resp.examples } : {}),
              },
            },
          };
        } else {
          normalizedResponses[statusCode] = resp;
        }
      }
      op.responses = normalizedResponses;
      nextPathItem[key] = op;
    }
    normalizedPaths[pathKey] = nextPathItem;
  }

  return {
    openapi: '3.0.3',
    info: cloned.info || { title: 'Swagger 2.0 API', version: '1.0.0' },
    servers,
    tags: cloned.tags || [],
    paths: normalizedPaths,
    components: {
      schemas: definitions,
      securitySchemes: securityDefinitions,
    },
    security: cloned.security,
  };
}

export function parseOpenApiDocument(raw: string): OpenApiParsedDoc {
  const { doc: rawDoc } = parseRawSpecObject(raw);
  const specVersionKind = detectSpecVersionKind(rawDoc);

  const normalized =
    specVersionKind === 'swagger-2.0' ? normalizeSwagger2ToOpenApi3(rawDoc) : rawDoc;

  const info = (normalized.info || {}) as Record<string, unknown>;
  const title = typeof info.title === 'string' ? info.title : 'Untitled API Specification';
  const version = typeof info.version === 'string' ? info.version : '1.0.0';
  const description = typeof info.description === 'string' ? info.description : undefined;

  const servers = Array.isArray(normalized.servers)
    ? (normalized.servers as Array<Record<string, unknown>>)
        .filter((s) => typeof s?.url === 'string')
        .map((s) => ({
          url: String(s.url),
          description: typeof s.description === 'string' ? s.description : undefined,
        }))
    : [];

  const tags = Array.isArray(normalized.tags)
    ? (normalized.tags as Array<Record<string, unknown>>)
        .filter((t) => typeof t?.name === 'string')
        .map((t) => ({
          name: String(t.name),
          description: typeof t.description === 'string' ? t.description : undefined,
        }))
    : [];

  const components = (normalized.components || {}) as Record<string, unknown>;
  const schemas = (components.schemas || {}) as Record<string, Record<string, unknown>>;
  const rawSecSchemes = (components.securitySchemes || {}) as Record<string, Record<string, unknown>>;

  const securitySchemes: OpenApiSecuritySchemeEntry[] = Object.entries(rawSecSchemes).map(
    ([name, scheme]) => ({
      name,
      type: typeof scheme.type === 'string' ? scheme.type : 'http',
      scheme: typeof scheme.scheme === 'string' ? scheme.scheme : undefined,
      in: typeof scheme.in === 'string' ? scheme.in : undefined,
      bearerFormat: typeof scheme.bearerFormat === 'string' ? scheme.bearerFormat : undefined,
      description: typeof scheme.description === 'string' ? scheme.description : undefined,
    })
  );

  const endpoints: OpenApiEndpointItem[] = [];
  const rawPaths = (normalized.paths || {}) as Record<string, Record<string, unknown>>;

  for (const [pathStr, pathObj] of Object.entries(rawPaths)) {
    if (!pathObj || typeof pathObj !== 'object') continue;

    const pathLevelParams = Array.isArray(pathObj.parameters)
      ? (pathObj.parameters as Array<Record<string, unknown>>)
      : [];

    for (const methodKey of Object.keys(pathObj)) {
      const methodUpper = methodKey.toUpperCase() as HttpMethod;
      if (!HTTP_METHODS.includes(methodUpper)) continue;
      const op = pathObj[methodKey];
      if (!op || typeof op !== 'object') continue;
      const opObj = op as Record<string, unknown>;

      const opParamsRaw = Array.isArray(opObj.parameters)
        ? (opObj.parameters as Array<Record<string, unknown>>)
        : [];
      const combinedParams = [...pathLevelParams, ...opParamsRaw];
      const paramMap = new Map<string, OpenApiParameter>();

      for (const rawParam of combinedParams) {
        const resolvedParam =
          typeof rawParam.$ref === 'string'
            ? resolveJsonPointer(normalized, rawParam.$ref) || rawParam
            : rawParam;
        const name = String(resolvedParam.name || '');
        const loc = (resolvedParam.in as OpenApiParameter['in']) || 'query';
        if (!name) continue;
        paramMap.set(`${loc}:${name}`, {
          name,
          in: loc,
          required: Boolean(resolvedParam.required) || loc === 'path',
          description:
            typeof resolvedParam.description === 'string' ? resolvedParam.description : undefined,
          schema: resolveSchemaRefs(resolvedParam.schema, normalized),
          example: resolvedParam.example,
        });
      }

      let requestBody: OpenApiRequestBodySpec | undefined;
      if (opObj.requestBody && typeof opObj.requestBody === 'object') {
        const rawBody = opObj.requestBody as Record<string, unknown>;
        const resolvedBody =
          typeof rawBody.$ref === 'string'
            ? resolveJsonPointer(normalized, rawBody.$ref) || rawBody
            : rawBody;
        const content = (resolvedBody.content || {}) as Record<string, Record<string, unknown>>;
        const contentTypes = Object.keys(content);
        const primaryMedia = content['application/json'] || content[contentTypes[0]];
        const resolvedSchema = primaryMedia?.schema
          ? resolveSchemaRefs(primaryMedia.schema, normalized)
          : undefined;
        const exampleObj =
          primaryMedia?.example !== undefined
            ? primaryMedia.example
            : resolvedSchema
              ? generateSampleFromSchema(resolvedSchema, normalized)
              : undefined;

        requestBody = {
          required: Boolean(resolvedBody.required),
          description:
            typeof resolvedBody.description === 'string' ? resolvedBody.description : undefined,
          contentTypes,
          schema: resolvedSchema,
          exampleJson:
            exampleObj !== undefined ? JSON.stringify(exampleObj, null, 2) : undefined,
        };
      }

      const rawResponses = (opObj.responses || {}) as Record<string, Record<string, unknown>>;
      const responses: OpenApiResponseSpec[] = Object.entries(rawResponses).map(
        ([statusCode, rawResp]) => {
          const resolvedResp =
            typeof rawResp?.$ref === 'string'
              ? resolveJsonPointer(normalized, rawResp.$ref) || rawResp
              : rawResp || {};
          const content = (resolvedResp.content || {}) as Record<string, Record<string, unknown>>;
          const contentTypes = Object.keys(content);
          const primaryMedia = content['application/json'] || content[contentTypes[0]];
          const resolvedSchema = primaryMedia?.schema
            ? resolveSchemaRefs(primaryMedia.schema, normalized)
            : undefined;
          const exampleObj =
            primaryMedia?.example !== undefined
              ? primaryMedia.example
              : resolvedSchema
                ? generateSampleFromSchema(resolvedSchema, normalized)
                : undefined;

          return {
            statusCode,
            description:
              typeof resolvedResp.description === 'string' ? resolvedResp.description : '',
            contentTypes,
            schema: resolvedSchema,
            exampleJson:
              exampleObj !== undefined ? JSON.stringify(exampleObj, null, 2) : undefined,
            headers: resolvedResp.headers as OpenApiResponseSpec['headers'],
          };
        }
      );

      const opTags =
        Array.isArray(opObj.tags) && opObj.tags.length > 0
          ? opObj.tags.map(String)
          : ['General'];

      endpoints.push({
        id: `${methodUpper}:${pathStr}`,
        method: methodUpper,
        path: pathStr,
        operationId: typeof opObj.operationId === 'string' ? opObj.operationId : undefined,
        summary: typeof opObj.summary === 'string' ? opObj.summary : undefined,
        description: typeof opObj.description === 'string' ? opObj.description : undefined,
        tags: opTags,
        deprecated: Boolean(opObj.deprecated),
        parameters: Array.from(paramMap.values()),
        requestBody,
        responses,
        security: Array.isArray(opObj.security)
          ? (opObj.security as Array<Record<string, string[]>>)
          : Array.isArray(normalized.security)
            ? (normalized.security as Array<Record<string, string[]>>)
            : undefined,
      });
    }
  }

  return {
    title,
    version,
    description,
    specVersionKind,
    servers,
    tags,
    endpoints,
    schemas,
    securitySchemes,
    normalizedDocument: normalized,
  };
}

export function generateRequestFromEndpoint(
  endpoint: OpenApiEndpointItem,
  options: {
    baseUrl?: string;
    collectionId?: string;
    folderId?: string;
    parsedDoc?: OpenApiParsedDoc;
  } = {}
): ApiRequest {
  const now = Date.now();
  const baseUrl =
    options.baseUrl?.trim() ||
    options.parsedDoc?.servers?.[0]?.url ||
    '{{base_url}}';

  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  let resolvedPath = endpoint.path.startsWith('/') ? endpoint.path : `/${endpoint.path}`;

  // Substitute {param} with example or {{param}} placeholder
  for (const param of endpoint.parameters.filter((p) => p.in === 'path')) {
    const val =
      param.example !== undefined
        ? String(param.example)
        : param.schema?.example !== undefined
          ? String(param.schema.example)
          : `{{${param.name}}}`;
    resolvedPath = resolvedPath.replaceAll(`{${param.name}}`, val);
  }

  const queryParams: KeyValueItem[] = endpoint.parameters
    .filter((p) => p.in === 'query')
    .map((p, idx) => ({
      id: makeId(`param-${idx}`),
      key: p.name,
      value:
        p.example !== undefined
          ? String(p.example)
          : p.schema?.example !== undefined
            ? String(p.schema.example)
            : '',
      description: p.description,
      enabled: p.required,
    }));

  const headers: KeyValueItem[] = endpoint.parameters
    .filter((p) => p.in === 'header')
    .map((p, idx) => ({
      id: makeId(`hdr-${idx}`),
      key: p.name,
      value:
        p.example !== undefined
          ? String(p.example)
          : p.schema?.example !== undefined
            ? String(p.schema.example)
            : '',
      description: p.description,
      enabled: p.required,
    }));

  const rawJson = endpoint.requestBody?.exampleJson || '';
  const hasJsonBody = Boolean(
    endpoint.requestBody &&
      (endpoint.requestBody.contentTypes.some((ct) => ct.includes('json')) || rawJson)
  );

  let authType: ApiRequest['auth']['type'] = 'none';
  let bearerToken: string | undefined;
  if (endpoint.security && endpoint.security.length > 0 && options.parsedDoc) {
    const firstKey = Object.keys(endpoint.security[0] || {})[0];
    const scheme = options.parsedDoc.securitySchemes.find((s) => s.name === firstKey);
    if (scheme?.type === 'http' && scheme.scheme === 'bearer') {
      authType = 'bearer';
      bearerToken = '{{auth_token}}';
    } else if (scheme?.type === 'apiKey') {
      authType = 'apikey';
    } else if (scheme?.type === 'http' && scheme.scheme === 'basic') {
      authType = 'basic';
    }
  }

  return {
    id: makeId('req'),
    name: endpoint.summary || endpoint.operationId || `${endpoint.method} ${endpoint.path}`,
    requestType: 'http',
    method: endpoint.method,
    url: `${cleanBase}${resolvedPath}`,
    params: queryParams,
    headers,
    auth: {
      type: authType,
      ...(authType === 'bearer' ? { bearer: { token: bearerToken || '', prefix: 'Bearer' } } : {}),
    },
    body: {
      mode: hasJsonBody ? 'json' : 'none',
      rawContent: {
        json: rawJson,
        text: '',
        xml: '',
        html: '',
      },
      formData: [],
      urlEncoded: [],
      binary: {},
    },
    bodyType: hasJsonBody ? 'json' : 'none',
    rawBody: rawJson,
    formData: [],
    urlEncoded: [],
    scripts: {
      preRequest: { script: '', enabled: false },
      postResponse: { script: '', enabled: false },
    },
    preRequestScript: '',
    testScript: '',
    settings: {
      timeout: 10000,
      followRedirects: true,
      maxRedirects: 5,
      autoEncodeUrl: true,
      sslVerification: true,
      allowInsecureCertificates: false,
      httpVersion: 'auto',
      connectionTimeout: 5000,
      keepAlive: true,
      disableCache: false,
      followAuthRedirects: true,
      customUserAgent: 'API-Studio/2.0',
    },
    collectionId: options.collectionId,
    folderId: options.folderId,
    createdAt: now,
    updatedAt: now,
  };
}
