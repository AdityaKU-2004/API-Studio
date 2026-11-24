import { describe, it, expect } from 'vitest';
import {
  parseOpenApiDocument,
  parseRawSpecObject,
  serializeSpecObject,
  generateRequestFromEndpoint,
} from '../../services/openapi/openapiParser';
import { validateOpenApiSpec } from '../../services/openapi/openapiValidator';
import {
  buildEndpointCurlExample,
  escapeHtml,
  generateHtmlDocumentation,
  generateMarkdownDocumentation,
  generatePdfDocumentationBlob,
} from '../../services/documentation/docGenerator';

const SAMPLE_OPENAPI_YAML = `openapi: 3.0.3
info:
  title: Orders API <script>alert("xss")</script>
  version: 1.2.0
  description: Manage customer orders cleanly
servers:
  - url: https://orders.example.com/v1
    description: Production
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  schemas:
    OrderNode:
      type: object
      required: [id, total]
      properties:
        id:
          type: string
          example: ord_99
        total:
          type: number
          example: 42.5
        parent:
          $ref: '#/components/schemas/OrderNode'
paths:
  /orders/{orderId}:
    get:
      summary: Get Order
      operationId: getOrder
      tags: [Orders]
      security:
        - bearerAuth: []
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: string
            example: ord_123
        - name: verbose
          in: query
          required: false
          schema:
            type: boolean
      responses:
        '200':
          description: Order record
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderNode'
`;

const SAMPLE_SWAGGER_2 = JSON.stringify({
  swagger: '2.0',
  info: { title: 'Legacy Pets', version: '2.0.1' },
  host: 'pets.example.org',
  basePath: '/api',
  schemes: ['https'],
  paths: {
    '/pets': {
      post: {
        summary: 'Create Pet',
        operationId: 'createPet',
        parameters: [
          {
            in: 'body',
            name: 'body',
            required: true,
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', example: 'Rex' },
              },
            },
          },
        ],
        responses: {
          '201': {
            description: 'Created pet',
          },
        },
      },
    },
  },
});

describe('Phase 8: OpenAPI Parser, Validator & Documentation Generator', () => {
  it('parses OpenAPI 3.0 YAML with cycle-safe $ref resolution and extracts endpoints', () => {
    const parsed = parseOpenApiDocument(SAMPLE_OPENAPI_YAML);
    expect(parsed.title).toContain('Orders API');
    expect(parsed.version).toBe('1.2.0');
    expect(parsed.specVersionKind).toBe('openapi-3.0');
    expect(parsed.servers[0].url).toBe('https://orders.example.com/v1');
    expect(parsed.endpoints.length).toBe(1);

    const ep = parsed.endpoints[0];
    expect(ep.method).toBe('GET');
    expect(ep.path).toBe('/orders/{orderId}');
    expect(ep.parameters.map((p) => p.name)).toEqual(['orderId', 'verbose']);
    expect(ep.responses[0].exampleJson).toContain('ord_99');

    // Request generation with path param & bearer auth mapping
    const req = generateRequestFromEndpoint(ep, { parsedDoc: parsed, collectionId: 'col-1' });
    expect(req.url).toBe('https://orders.example.com/v1/orders/ord_123');
    expect(req.auth.type).toBe('bearer');
    expect(req.collectionId).toBe('col-1');
  });

  it('normalizes Swagger 2.0 host/basePath/body parameters into OpenAPI 3.0 structure', () => {
    const parsed = parseOpenApiDocument(SAMPLE_SWAGGER_2);
    expect(parsed.specVersionKind).toBe('swagger-2.0');
    expect(parsed.servers[0].url).toBe('https://pets.example.org/api');
    expect(parsed.endpoints).toHaveLength(1);
    expect(parsed.endpoints[0].requestBody?.exampleJson).toContain('Rex');
  });

  it('converts between YAML and JSON cleanly and reports line/column validation issues', () => {
    const { doc } = parseRawSpecObject(SAMPLE_OPENAPI_YAML);
    const jsonOut = serializeSpecObject(doc, 'json');
    expect(jsonOut.trim().startsWith('{')).toBe(true);
    const yamlOut = serializeSpecObject(JSON.parse(jsonOut), 'yaml');
    expect(yamlOut).toContain('openapi: 3.0.3');

    const issuesValid = validateOpenApiSpec(SAMPLE_OPENAPI_YAML);
    expect(issuesValid.filter((i) => i.severity === 'error')).toHaveLength(0);

    const badSpec = `openapi: 3.0.0\ninfo:\n  description: Missing title and version\npaths:\n  badpath:\n    get:\n      responses: {}`;
    const issuesInvalid = validateOpenApiSpec(badSpec);
    const errors = issuesInvalid.filter((i) => i.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.every((e) => e.line >= 1 && e.column >= 1)).toBe(true);
  });

  it('generates XSS-escaped HTML, Markdown, cURL examples, and PDF blobs', () => {
    const parsed = parseOpenApiDocument(SAMPLE_OPENAPI_YAML);
    const md = generateMarkdownDocumentation(parsed);
    expect(md).toContain('# Orders API');
    expect(md).toContain('### `GET` `/orders/{orderId}`');

    const curl = buildEndpointCurlExample(parsed.endpoints[0], parsed.servers[0].url);
    expect(curl).toContain('curl -X GET');
    expect(curl).toContain('Authorization: Bearer <token>');

    const html = generateHtmlDocumentation(parsed, 'dark');
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain(escapeHtml('<script>alert("xss")</script>'));

    const pdfBlob = generatePdfDocumentationBlob(parsed);
    expect(pdfBlob.size).toBeGreaterThan(200);
  });
});
