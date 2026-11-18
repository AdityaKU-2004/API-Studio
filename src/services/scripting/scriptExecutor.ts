import { ScriptExecutionContext, ScriptExecutionResult } from '../../types';
import { sandboxManager } from './sandboxManager';

export class ScriptExecutor {
  /**
   * Executes a pre-request, post-response, or test script inside the QuickJS WASM sandbox.
   */
  public async execute(
    code: string,
    context: ScriptExecutionContext,
    executionId?: string
  ): Promise<ScriptExecutionResult> {
    return sandboxManager.execute(code, context, executionId);
  }

  /**
   * Cancels an active script execution immediately.
   */
  public cancel(executionId: string): void {
    sandboxManager.cancel(executionId);
  }
}

export const scriptExecutor = new ScriptExecutor();
