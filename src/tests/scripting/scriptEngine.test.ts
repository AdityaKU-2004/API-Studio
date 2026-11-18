import { describe, it, expect } from 'vitest';
import { executeInQuickJsSandbox } from '../../services/scripting/quickJsSandbox';
import { sandboxManager } from '../../services/scripting/sandboxManager';
import { buildScriptExecutionContext } from '../../services/scripting/scriptContext';
import { createDefaultRequest } from '../../stores/requestStore';

function makeContext(overrides?: Partial<ReturnType<typeof buildScriptExecutionContext>>) {
  const req = createDefaultRequest('Test Req', 'GET');
  const base = buildScriptExecutionContext({
    stage: 'pre-request',
    request: req,
    environmentVariables: { base_url: 'https://api.example.com' },
    secretValues: ['super-secret-token-123'],
  });
  return { ...base, ...overrides };
}

describe('Phase 5: QuickJS Sandboxed Scripting Engine', () => {
  it('1. executes basic JavaScript cleanly and records execution duration', async () => {
    const res = await executeInQuickJsSandbox(
      `
      const a = 21;
      const b = a * 2;
      pm.environment.set("answer", String(b));
      `,
      makeContext()
    );
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.variableUpdates.environment.answer).toBe('42');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('2. catches syntax errors and reports line number cleanly', async () => {
    const res = await executeInQuickJsSandbox(
      `const x = 1;\nconst broken = (;\n`,
      makeContext()
    );
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe('syntax');
    expect(res.error?.line).toBe(2);
  });

  it('3. catches runtime errors and returns structured error info', async () => {
    const res = await executeInQuickJsSandbox(
      `const x = 10;\nthrow new Error("Boom at line 2");`,
      makeContext()
    );
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe('runtime');
    expect(res.error?.message).toContain('Boom at line 2');
    expect(res.error?.line).toBe(2);
  });

  it('4. interrupts infinite loops cleanly on timeout', async () => {
    const res = await executeInQuickJsSandbox(
      `while (true) {}`,
      makeContext({ timeoutMs: 80 })
    );
    expect(res.success).toBe(false);
    expect(res.timedOut).toBe(true);
    expect(res.error?.type).toBe('timeout');
  });

  it('5. supports cancellation mid-execution via interrupt handler and sandboxManager', async () => {
    let ticks = 0;
    const midLoopRes = await executeInQuickJsSandbox(
      `let i = 0; while (true) { i++; }`,
      makeContext({ timeoutMs: 5000 }),
      { isCancelled: () => ++ticks > 20 }
    );
    expect(midLoopRes.success).toBe(false);
    expect(midLoopRes.cancelled).toBe(true);
    expect(midLoopRes.error?.type).toBe('cancelled');

    const execId = 'cancel-test-mgr';
    const promise = sandboxManager.execute(
      `pm.environment.set("shouldNotRun", "yes");`,
      makeContext({ timeoutMs: 5000 }),
      execId
    );
    sandboxManager.cancel(execId);
    const mgrRes = await promise;
    expect(mgrRes.success).toBe(false);
    expect(mgrRes.cancelled).toBe(true);
    expect(mgrRes.error?.type).toBe('cancelled');
  });

  it('6. isolates sandbox from window, document, localStorage, indexedDB, process, require, and fetch', async () => {
    const res = await executeInQuickJsSandbox(
      `
      const checks = [
        typeof window,
        typeof document,
        typeof localStorage,
        typeof indexedDB,
        typeof process,
        typeof require,
        typeof fetch
      ];
      pm.environment.set("types", checks.join(","));
      `,
      makeContext()
    );
    expect(res.success).toBe(true);
    expect(res.variableUpdates.environment.types).toBe(
      'undefined,undefined,undefined,undefined,undefined,undefined,undefined'
    );
  });

  it('7. captures console.log/warn/error and masks secret values', async () => {
    const res = await executeInQuickJsSandbox(
      `
      console.log("normal log", { ok: true });
      console.warn("leaked token super-secret-token-123");
      console.error("failure reason");
      `,
      makeContext()
    );
    expect(res.success).toBe(true);
    expect(res.logs).toHaveLength(3);
    expect(res.logs[0].level).toBe('log');
    expect(res.logs[0].message).toContain('"ok":true');
    expect(res.logs[1].level).toBe('warn');
    expect(res.logs[1].message).not.toContain('super-secret-token-123');
    expect(res.logs[1].message).toContain('••••••••');
    expect(res.logs[2].level).toBe('error');
  });

  it('8. enforces QuickJS memory limit and fails gracefully without crashing host', async () => {
    const res = await executeInQuickJsSandbox(
      `
      const arr = [];
      for (let i = 0; i < 1000000; i++) {
        arr.push("allocating-lots-of-string-memory-" + i);
      }
      `,
      makeContext({ memoryLimitBytes: 2 * 1024 * 1024, timeoutMs: 2000 })
    );
    expect(res.success).toBe(false);
    expect(['memory', 'timeout', 'runtime']).toContain(res.error?.type);
  });
});
