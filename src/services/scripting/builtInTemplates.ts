import { ScriptTemplate } from '../../types';

const NOW = 1710000000000;

export const BUILT_IN_SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'tpl-status-200',
    name: 'Status Code Validation',
    description: 'Verifies that the HTTP status code is 200 OK or within the expected 2xx range.',
    category: 'testing',
    stage: 'post-response',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});`,
  },
  {
    id: 'tpl-response-time',
    name: 'Response Time Validation',
    description: 'Asserts that the API response latency is below a target SLA threshold (500ms).',
    category: 'testing',
    stage: 'post-response',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `pm.test("Response time is less than 500ms", function () {
  pm.expect(pm.response.responseTime).to.be.below(500);
});`,
  },
  {
    id: 'tpl-json-property',
    name: 'JSON Body Property Assertion',
    description: 'Parses JSON body and validates nested fields and data types.',
    category: 'validation',
    stage: 'post-response',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `pm.test("Response body contains valid user object", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("id");
});`,
  },
  {
    id: 'tpl-env-extraction',
    name: 'Environment Variable Extraction',
    description: 'Extracts a resource ID from the JSON response and stores it in the active environment.',
    category: 'variables',
    stage: 'post-response',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `const data = pm.response.json();
if (data && data.id !== undefined) {
  pm.environment.set("last_created_id", String(data.id));
  console.log("Saved last_created_id:", data.id);
}`,
  },
  {
    id: 'tpl-token-extraction',
    name: 'Token Extraction (Auth Flow)',
    description: 'Extracts access_token / token from a login response into environment variables.',
    category: 'security',
    stage: 'post-response',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `pm.test("Authentication response contains access token", function () {
  const payload = pm.response.json();
  const token = payload.accessToken || payload.access_token || payload.token;
  pm.expect(token).to.exist;
  pm.environment.set("auth_token", String(token));
});`,
  },
  {
    id: 'tpl-dynamic-timestamp',
    name: 'Dynamic Request Timestamp & Nonce',
    description: 'Generates an ISO timestamp and unique trace ID before sending the HTTP request.',
    category: 'pre-request',
    stage: 'pre-request',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `const now = Date.now();
const traceId = "trace-" + now + "-" + Math.floor(Math.random() * 10000);
pm.variables.set("request_timestamp", String(now));
pm.variables.set("trace_id", traceId);
console.log("Prepared trace_id:", traceId);`,
  },
  {
    id: 'tpl-header-injection',
    name: 'Request Variable Header Prep',
    description: 'Sets scoped correlation variables and verifies base configuration prior to dispatch.',
    category: 'pre-request',
    stage: 'pre-request',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `const baseUrl = pm.variables.get("base_url");
if (!baseUrl) {
  console.warn("base_url is not configured in the active environment");
}
pm.environment.set("correlation_id", "corr-" + Date.now());`,
  },
  {
    id: 'tpl-array-verification',
    name: 'Array Item Verification',
    description: 'Checks that a collection response is an array, non-empty, and matches expected element structure.',
    category: 'validation',
    stage: 'post-response',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `pm.test("Response returns non-empty array", function () {
  const items = pm.response.json();
  pm.expect(items).to.be.an("array");
  pm.expect(items.length).to.be.above(0);
  pm.expect(items[0]).to.have.property("id");
});`,
  },
  {
    id: 'tpl-header-check',
    name: 'Header Validation',
    description: 'Verifies required response headers such as Content-Type are present.',
    category: 'testing',
    stage: 'post-response',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `pm.test("Content-Type header is JSON", function () {
  pm.response.to.have.header("Content-Type");
  const ct = pm.response.headers["content-type"] || pm.response.headers["Content-Type"] || "";
  pm.expect(ct).to.include("application/json");
});`,
  },
  {
    id: 'tpl-conditional-test',
    name: 'Conditional Test Execution',
    description: 'Runs deeper payload checks only when status code is 200 or 201, or inspects iteration data.',
    category: 'testing',
    stage: 'post-response',
    isBuiltIn: true,
    createdAt: NOW,
    updatedAt: NOW,
    code: `pm.test("Status is success (200 or 201)", function () {
  pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

if (pm.response.code === 200) {
  pm.test("200 response includes payload", function () {
    pm.expect(pm.response.text()).to.not.be.empty;
  });
}`,
  },
];
