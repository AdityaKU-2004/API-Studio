import { getQuickJS, type QuickJSWASMModule } from 'quickjs-emscripten';
import {
  ScriptConsoleEntry,
  ScriptConsoleLevel,
  ScriptExecutionContext,
  ScriptExecutionError,
  ScriptExecutionResult,
  ScriptTestOutcome,
  ScriptVariableUpdates,
} from '../../types';
import { PM_BOOTSTRAP_CODE } from './pmBootstrap';

let quickJsModulePromise: Promise<QuickJSWASMModule> | null = null;

async function getQuickJsModule(): Promise<QuickJSWASMModule> {
  if (!quickJsModulePromise) {
    quickJsModulePromise = getQuickJS();
  }
  return quickJsModulePromise;
}

export interface QuickJsHandleController {
  cancel: () => void;
}

function maskSecretsInMessage(message: string, context: ScriptExecutionContext): string {
  if (context.allowSecretLogging || !context.secretValues || context.secretValues.length === 0) {
    return message;
  }
  let masked = message;
  for (const secret of context.secretValues) {
    if (secret && secret.length >= 2) {
      masked = masked.split(secret).join('••••••••');
    }
  }
  return masked;
}

function parseLineColumnFromError(errObj: Record<string, unknown>): {
  line?: number;
  column?: number;
} {
  const stack = typeof errObj.stack === 'string' ? errObj.stack : '';
  const msg = typeof errObj.message === 'string' ? errObj.message : '';
  const combined = `${stack}\n${msg}`;

  // QuickJS formats frames as: "at <anonymous> (user-script.js:3:5)" or "at user-script.js:2"
  const match = combined.match(/user-script\.js:(\d+)(?::(\d+))?/);
  if (match) {
    return {
      line: parseInt(match[1], 10),
      column: match[2] ? parseInt(match[2], 10) : undefined,
    };
  }
  if (typeof errObj.lineNumber === 'number') {
    return { line: errObj.lineNumber };
  }
  return {};
}

function classifyError(
  errObj: unknown,
  interruptReason: 'timeout' | 'cancelled' | null
): ScriptExecutionError {
  if (interruptReason === 'cancelled') {
    return {
      type: 'cancelled',
      message: 'Script execution was cancelled by user.',
    };
  }
  if (interruptReason === 'timeout') {
    return {
      type: 'timeout',
      message: 'Script execution timed out.',
    };
  }

  if (!errObj || typeof errObj !== 'object') {
    return {
      type: 'runtime',
      message: String(errObj || 'Unknown script execution error'),
    };
  }

  const record = errObj as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name : 'Error';
  const message = typeof record.message === 'string' ? record.message : String(errObj);
  const stack = typeof record.stack === 'string' ? record.stack : undefined;
  const loc = parseLineColumnFromError(record);

  if (name === 'SyntaxError') {
    return {
      type: 'syntax',
      message,
      line: loc.line,
      column: loc.column,
      stack,
    };
  }

  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes('out of memory') ||
    lowerMsg.includes('memory limit') ||
    lowerMsg.includes('allocation failed')
  ) {
    return {
      type: 'memory',
      message: `Script memory limit exceeded: ${message}`,
      line: loc.line,
      column: loc.column,
      stack,
    };
  }

  if (lowerMsg.includes('interrupted')) {
    return {
      type: 'timeout',
      message: 'Script execution interrupted (timeout or resource limit exceeded).',
      line: loc.line,
      column: loc.column,
      stack,
    };
  }

  return {
    type: 'runtime',
    message: `${name}: ${message}`,
    line: loc.line,
    column: loc.column,
    stack,
  };
}

/**
 * Executes JavaScript in an isolated QuickJS WebAssembly runtime.
 * Never touches window, document, localStorage, IndexedDB, fetch, process, or require.
 */
export async function executeInQuickJsSandbox(
  code: string,
  context: ScriptExecutionContext,
  externalSignal?: { isCancelled: () => boolean }
): Promise<ScriptExecutionResult> {
  const startTime = performance.now();
  const logs: ScriptConsoleEntry[] = [];
  const tests: ScriptTestOutcome[] = [];
  const variableUpdates: ScriptVariableUpdates = {
    environment: {},
    collectionVariables: {},
    globals: {},
    variables: {},
  };

  if (!code || !code.trim()) {
    return {
      success: true,
      stage: context.stage,
      durationMs: 0,
      logs,
      tests,
      variableUpdates,
    };
  }

  const timeoutMs = Math.max(50, context.timeoutMs ?? 3000);
  const memoryLimitBytes = Math.max(1024 * 1024, context.memoryLimitBytes ?? 16 * 1024 * 1024);

  const quickJs = await getQuickJsModule();
  const runtime = quickJs.newRuntime();
  runtime.setMemoryLimit(memoryLimitBytes);
  runtime.setMaxStackSize(512 * 1024);

  let interruptReason: 'timeout' | 'cancelled' | null = null;
  const deadline = Date.now() + timeoutMs;

  runtime.setInterruptHandler(() => {
    if (externalSignal?.isCancelled()) {
      interruptReason = 'cancelled';
      return true;
    }
    if (Date.now() > deadline) {
      interruptReason = 'timeout';
      return true;
    }
    return false;
  });

  const vm = runtime.newContext();

  const pushLog = (level: ScriptConsoleLevel, rawMessage: string) => {
    const clean = maskSecretsInMessage(rawMessage, context);
    logs.push({
      id: `slog-${Date.now()}-${logs.length}-${Math.random().toString(36).substring(2, 6)}`,
      level,
      message: clean,
      timestamp: Date.now(),
      stage: context.stage,
    });
  };

  try {
    // 1. Register minimal bridge host functions (no DOM/storage/fetch exposed)
    const logFn = vm.newFunction('__hostLog', (levelHandle, msgHandle) => {
      const level = (vm.getString(levelHandle) as ScriptConsoleLevel) || 'log';
      const msg = vm.getString(msgHandle);
      pushLog(level, msg);
    });
    vm.setProp(vm.global, '__hostLog', logFn);
    logFn.dispose();

    const getContextFn = vm.newFunction('__hostGetContext', () => {
      const serialized = JSON.stringify({
        stage: context.stage,
        request: context.request,
        response: context.response,
        environmentVariables: context.environmentVariables,
        collectionVariables: context.collectionVariables,
        globalVariables: context.globalVariables,
        localVariables: context.localVariables,
        iterationData: context.iterationData || {},
      });
      const jsonParseResult = vm.evalCode(`(${serialized})`);
      return vm.unwrapResult(jsonParseResult);
    });
    vm.setProp(vm.global, '__hostGetContext', getContextFn);
    getContextFn.dispose();

    const varOpFn = vm.newFunction('__hostVarOp', (scopeHandle, opHandle, keyHandle, valHandle) => {
      const scope = vm.getString(scopeHandle) as keyof ScriptVariableUpdates;
      const op = vm.getString(opHandle);
      const key = vm.getString(keyHandle);
      const val = op === 'unset' ? null : vm.getString(valHandle);
      if (variableUpdates[scope]) {
        variableUpdates[scope][key] = val;
      }
    });
    vm.setProp(vm.global, '__hostVarOp', varOpFn);
    varOpFn.dispose();

    const recordTestFn = vm.newFunction(
      '__hostRecordTest',
      (nameH, passedH, errH, expectedH, actualH, durH) => {
        const name = vm.getString(nameH);
        const passed = Boolean(vm.dump(passedH));
        const err = vm.dump(errH);
        const expected = vm.dump(expectedH);
        const actual = vm.dump(actualH);
        const durationMs = Number(vm.dump(durH)) || 0;

        tests.push({
          id: `stest-${Date.now()}-${tests.length}`,
          name,
          passed,
          status: passed ? 'passed' : 'failed',
          error: typeof err === 'string' && err ? maskSecretsInMessage(err, context) : undefined,
          expected: typeof expected === 'string' && expected ? expected : undefined,
          actual: typeof actual === 'string' && actual ? actual : undefined,
          durationMs,
          source: 'script',
        });
      }
    );
    vm.setProp(vm.global, '__hostRecordTest', recordTestFn);
    recordTestFn.dispose();

    // 2. Evaluate PM Bootstrap cleanly
    const bootstrapResult = vm.evalCode(PM_BOOTSTRAP_CODE, 'pm-bootstrap.js');
    if (bootstrapResult.error) {
      const errDump = vm.dump(bootstrapResult.error);
      bootstrapResult.error.dispose();
      throw new Error(`PM bootstrap failure: ${JSON.stringify(errDump)}`);
    }
    bootstrapResult.value.dispose();

    // 3. Evaluate user script cleanly (exact 1-based line numbers preserved)
    const userResult = vm.evalCode(code, 'user-script.js');
    if (userResult.error) {
      const errDump = vm.dump(userResult.error);
      userResult.error.dispose();
      const parsedError = classifyError(errDump, interruptReason);
      return {
        success: false,
        stage: context.stage,
        durationMs: Math.round(performance.now() - startTime),
        logs,
        tests,
        variableUpdates,
        error: parsedError,
        cancelled: parsedError.type === 'cancelled',
        timedOut: parsedError.type === 'timeout',
      };
    }
    userResult.value.dispose();

    // Execute any pending microtasks within budget
    while (runtime.hasPendingJob()) {
      const jobRes = runtime.executePendingJobs(1);
      if (jobRes.error) {
        const errDump = vm.dump(jobRes.error);
        jobRes.error.dispose();
        const parsedError = classifyError(errDump, interruptReason);
        return {
          success: false,
          stage: context.stage,
          durationMs: Math.round(performance.now() - startTime),
          logs,
          tests,
          variableUpdates,
          error: parsedError,
          cancelled: parsedError.type === 'cancelled',
          timedOut: parsedError.type === 'timeout',
        };
      }
    }

    return {
      success: true,
      stage: context.stage,
      durationMs: Math.round(performance.now() - startTime),
      logs,
      tests,
      variableUpdates,
    };
  } catch (err: unknown) {
    const parsedError = classifyError(err, interruptReason);
    return {
      success: false,
      stage: context.stage,
      durationMs: Math.round(performance.now() - startTime),
      logs,
      tests,
      variableUpdates,
      error: parsedError,
      cancelled: parsedError.type === 'cancelled',
      timedOut: parsedError.type === 'timeout',
    };
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
