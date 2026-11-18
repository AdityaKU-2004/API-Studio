import { describe, it, expect } from 'vitest';
import { executeInQuickJsSandbox } from '../../services/scripting/quickJsSandbox';
import { buildScriptExecutionContext } from '../../services/scripting/scriptContext';
import { createDefaultRequest } from '../../stores/requestStore';
import { ApiResponse } from '../../types';

function makeResponse(): ApiResponse {
  return {
    id: 'resp-1',
    requestId: 'req-1',
    status: 201,
    statusText: 'Created',
    ok: true,
    url: 'https://api.example.com/users',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-abc' },
    body: JSON.stringify({
      id: 99,
      name: 'Ada Lovelace',
      roles: ['admin', 'engineer'],
      meta: { active: true },
    }),
    rawBody: '{"id":99,"name":"Ada Lovelace","roles":["admin","engineer"],"meta":{"active":true}}',
    contentType: 'application/json',
    contentTypeCategory: 'json',
    size: 80,
    sizeBytes: 80,
    timeMs: 145,
    timing: { startTime: 0, endTime: 145, duration: 145, prepareMs: 2, waitingMs: 140, downloadMs: 3 },
    receivedAt: new Date().toISOString(),
    timestamp: Date.now(),
    cookies: [],
    tests: [],
  };
}

describe('Phase 5: pm API Compatibility Suite', () => {
  it('9. tracks multiple pm.test() pass and fail assertions cleanly', async () => {
    const req = createDefaultRequest('Create User', 'POST');
    const ctx = buildScriptExecutionContext({
      stage: 'post-response',
      request: req,
      response: makeResponse(),
    });
    const res = await executeInQuickJsSandbox(
      `
      pm.test("passes", () => { pm.expect(1 + 1).to.equal(2); });
      pm.test("fails cleanly", () => { pm.expect(10).to.equal(20); });
      `,
      ctx
    );
    expect(res.success).toBe(true);
    expect(res.tests).toHaveLength(2);
    expect(res.tests[0].passed).toBe(true);
    expect(res.tests[1].passed).toBe(false);
    expect(res.tests[1].error).toContain('Expected 10 to equal 20');
  });

  it('10. supports comprehensive pm.expect Chai-style chains', async () => {
    const req = createDefaultRequest('Test', 'GET');
    const ctx = buildScriptExecutionContext({
      stage: 'post-response',
      request: req,
      response: makeResponse(),
    });
    const res = await executeInQuickJsSandbox(
      `
      pm.test("expect chains", () => {
        const body = pm.response.json();
        pm.expect(body.id).to.exist;
        pm.expect(body.meta.active).to.be.true;
        pm.expect(body.roles).to.be.an("array");
        pm.expect(body.roles).to.include("admin");
        pm.expect(body.roles).to.have.lengthOf(2);
        pm.expect(body.name).to.match(/^Ada/);
        pm.expect(body.meta).to.deep.equal({ active: true });
        pm.expect(body).to.have.property("name", "Ada Lovelace");
        pm.expect(body.id).to.be.above(50);
        pm.expect(body.id).to.be.below(200);
        pm.expect(pm.response.code).to.be.oneOf([200, 201]);
        pm.expect(body.roles).to.not.be.empty;
      });
      `,
      ctx
    );
    expect(res.tests[0].passed).toBe(true);
  });

  it('11. exposes pm.response properties, text(), json(), and assertions', async () => {
    const req = createDefaultRequest('Test', 'POST');
    const ctx = buildScriptExecutionContext({
      stage: 'post-response',
      request: req,
      response: makeResponse(),
    });
    const res = await executeInQuickJsSandbox(
      `
      pm.test("pm.response API", () => {
        pm.response.to.have.status(201);
        pm.response.to.have.header("content-type");
        pm.expect(pm.response.to.be.ok).to.be.true;
        pm.expect(pm.response.responseTime).to.equal(145);
        pm.expect(pm.response.status).to.equal("Created");
        pm.expect(pm.response.text()).to.include("Ada Lovelace");
        pm.expect(pm.response.headers.get("X-Request-Id")).to.equal("req-abc");
      });
      `,
      ctx
    );
    expect(res.tests[0].passed).toBe(true);
  });

  it('12. exposes pm.request safely while masking sensitive Authorization header', async () => {
    const req = createDefaultRequest('Auth Req', 'POST');
    req.headers = [
      { id: 'h1', key: 'Authorization', value: 'Bearer secret-jwt', enabled: true },
      { id: 'h2', key: 'Accept', value: 'application/json', enabled: true },
    ];
    req.rawBody = '{"hello":"world"}';
    req.bodyType = 'json';

    const ctx = buildScriptExecutionContext({ stage: 'pre-request', request: req });
    const res = await executeInQuickJsSandbox(
      `
      pm.environment.set("req_method", pm.request.method);
      pm.environment.set("req_auth", pm.request.headers["Authorization"]);
      pm.environment.set("req_accept", pm.request.headers["Accept"]);
      `,
      ctx
    );
    expect(res.variableUpdates.environment.req_method).toBe('POST');
    expect(res.variableUpdates.environment.req_auth).toBe('••••••••');
    expect(res.variableUpdates.environment.req_accept).toBe('application/json');
  });

  it('13. supports pm.environment.get/set/unset/has', async () => {
    const req = createDefaultRequest('Env', 'GET');
    const ctx = buildScriptExecutionContext({
      stage: 'pre-request',
      request: req,
      environmentVariables: { existing: 'hello', removeMe: 'bye' },
    });
    const res = await executeInQuickJsSandbox(
      `
      pm.environment.set("added", pm.environment.get("existing") + "_world");
      pm.environment.unset("removeMe");
      pm.environment.set("hasExisting", String(pm.environment.has("existing")));
      pm.environment.set("hasRemoved", String(pm.environment.has("removeMe")));
      `,
      ctx
    );
    expect(res.variableUpdates.environment.added).toBe('hello_world');
    expect(res.variableUpdates.environment.removeMe).toBeNull();
    expect(res.variableUpdates.environment.hasExisting).toBe('true');
    expect(res.variableUpdates.environment.hasRemoved).toBe('false');
  });

  it('14. supports pm.collectionVariables operations', async () => {
    const req = createDefaultRequest('Col', 'GET');
    const ctx = buildScriptExecutionContext({
      stage: 'pre-request',
      request: req,
      collectionVariables: { version: 'v1' },
    });
    const res = await executeInQuickJsSandbox(
      `
      const v = pm.collectionVariables.get("version");
      pm.collectionVariables.set("next_version", v + "-beta");
      `,
      ctx
    );
    expect(res.variableUpdates.collectionVariables.next_version).toBe('v1-beta');
  });

  it('15. supports pm.globals operations', async () => {
    const req = createDefaultRequest('Glob', 'GET');
    const ctx = buildScriptExecutionContext({
      stage: 'pre-request',
      request: req,
      globalVariables: { org: 'Acme' },
    });
    const res = await executeInQuickJsSandbox(
      `
      pm.globals.set("greeting", "Hello " + pm.globals.get("org"));
      `,
      ctx
    );
    expect(res.variableUpdates.globals.greeting).toBe('Hello Acme');
  });

  it('16. supports pm.variables scope precedence, replaceIn(), and pm.iterationData.get()', async () => {
    const req = createDefaultRequest('Prec', 'GET');
    const ctx = buildScriptExecutionContext({
      stage: 'pre-request',
      request: req,
      globalVariables: { host: 'global.io', shared: 'fromGlobal' },
      collectionVariables: { shared: 'fromCollection' },
      environmentVariables: { shared: 'fromEnv', path: 'orders' },
      localVariables: { shared: 'fromLocal' },
      iterationData: { orderId: 'ORD-77' },
    });
    const res = await executeInQuickJsSandbox(
      `
      pm.environment.set("resolved_shared", pm.variables.get("shared"));
      pm.environment.set("iter_order", pm.iterationData.get("orderId"));
      pm.environment.set("built_url", pm.variables.replaceIn("https://{{host}}/{{path}}/{{orderId}}"));
      `,
      ctx
    );
    expect(res.variableUpdates.environment.resolved_shared).toBe('fromLocal');
    expect(res.variableUpdates.environment.iter_order).toBe('ORD-77');
    expect(res.variableUpdates.environment.built_url).toBe('https://global.io/orders/ORD-77');
  });
});
