import { getQuickJS } from 'quickjs-emscripten';

export interface ScriptSyntaxDiagnostic {
  valid: boolean;
  message?: string;
  line?: number;
  column?: number;
}

/**
 * Validates JavaScript syntax inside QuickJS without executing runtime side effects
 * by compiling via Function constructor inside QuickJS or parsing ast.
 * Note: QuickJS Function(code) only parses syntax without running the body.
 */
export async function validateScriptSyntax(code: string): Promise<ScriptSyntaxDiagnostic> {
  if (!code || !code.trim()) {
    return { valid: true };
  }

  try {
    const quickJs = await getQuickJS();
    const runtime = quickJs.newRuntime();
    runtime.setMemoryLimit(4 * 1024 * 1024);
    const vm = runtime.newContext();

    try {
      // Wrap in a function declaration inside QuickJS to validate syntax without executing body
      const wrapped = `(function() {\n${code}\n})`;
      const res = vm.evalCode(wrapped, 'user-script.js');
      if (res.error) {
        const dump = vm.dump(res.error) as Record<string, unknown>;
        res.error.dispose();
        const rawMsg = typeof dump?.message === 'string' ? dump.message : 'Syntax error';
        const stack = typeof dump?.stack === 'string' ? dump.stack : '';
        const match = `${stack}\n${rawMsg}`.match(/user-script\.js:(\d+)(?::(\d+))?/);
        // Subtract 1 line for wrapper header `(function() {\n`
        const parsedLine = match ? Math.max(1, parseInt(match[1], 10) - 1) : undefined;
        return {
          valid: false,
          message: rawMsg,
          line: parsedLine,
          column: match?.[2] ? parseInt(match[2], 10) : undefined,
        };
      }
      res.value.dispose();
      return { valid: true };
    } finally {
      vm.dispose();
      runtime.dispose();
    }
  } catch (err) {
    return {
      valid: false,
      message: err instanceof Error ? err.message : 'Failed to validate script syntax',
    };
  }
}
