export interface PmApiReferenceItem {
  symbol: string;
  signature: string;
  description: string;
  example: string;
}

export const PM_API_REFERENCE: PmApiReferenceItem[] = [
  {
    symbol: 'pm.test',
    signature: 'pm.test(name: string, fn: () => void)',
    description: 'Registers and executes a named assertion block in post-response scripts.',
    example: 'pm.test("Status is 200", () => { pm.response.to.have.status(200); });',
  },
  {
    symbol: 'pm.expect',
    signature: 'pm.expect(value).to...',
    description: 'Chai-style assertions (.equal, .eql, .include, .have.property, .be.a, .above, .below, .match, .oneOf, .not).',
    example: 'pm.expect(pm.response.json().items).to.have.lengthOf(3);',
  },
  {
    symbol: 'pm.response',
    signature: 'pm.response.{code, status, responseTime, headers, json(), text(), to.have.status(), to.have.header(), to.be.ok}',
    description: 'Read-only access and built-in assertions for the HTTP response.',
    example: 'const body = pm.response.json();',
  },
  {
    symbol: 'pm.request',
    signature: 'pm.request.{id, name, method, url, headers, queryParams, body}',
    description: 'Safe snapshot of the outgoing request (sensitive auth credentials masked).',
    example: 'console.log(pm.request.method, pm.request.url);',
  },
  {
    symbol: 'pm.environment',
    signature: 'pm.environment.{get, set, unset, has}(key, value?)',
    description: 'Reads or mutates active environment variables.',
    example: 'pm.environment.set("auth_token", data.token);',
  },
  {
    symbol: 'pm.collectionVariables',
    signature: 'pm.collectionVariables.{get, set, unset, has}(key, value?)',
    description: 'Reads or mutates variables scoped to the parent collection.',
    example: 'pm.collectionVariables.set("api_version", "v2");',
  },
  {
    symbol: 'pm.globals',
    signature: 'pm.globals.{get, set, unset, has}(key, value?)',
    description: 'Reads or mutates workspace-wide global variables.',
    example: 'pm.globals.set("last_run", String(Date.now()));',
  },
  {
    symbol: 'pm.variables',
    signature: 'pm.variables.{get, set, unset, has, replaceIn}(keyOrTemplate, value?)',
    description: 'Reads across scope precedence (local > iteration > environment > collection > global) or writes request-local variables.',
    example: 'const url = pm.variables.replaceIn("{{base_url}}/users");',
  },
  {
    symbol: 'pm.iterationData',
    signature: 'pm.iterationData.get(key)',
    description: 'Reads the current CSV/JSON row value during Collection Runner iterations.',
    example: 'const username = pm.iterationData.get("username");',
  },
];
