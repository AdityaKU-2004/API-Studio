import { ScriptExecutionContext, ScriptExecutionResult } from '../../types';
import { executeInQuickJsSandbox } from './quickJsSandbox';

interface ActiveExecution {
  executionId: string;
  stage: ScriptExecutionContext['stage'];
  cancelToken: { cancelled: boolean };
  resolve: (res: ScriptExecutionResult) => void;
  worker?: Worker;
  watchdog?: ReturnType<typeof setTimeout>;
}

const emptyResult = (
  stage: ScriptExecutionContext['stage'],
  partial?: Partial<ScriptExecutionResult>
): ScriptExecutionResult => ({
  success: false,
  stage,
  durationMs: 0,
  logs: [],
  tests: [],
  variableUpdates: { environment: {}, collectionVariables: {}, globals: {}, variables: {} },
  ...partial,
});

export class SandboxManager {
  private activeExecutions = new Map<string, ActiveExecution>();
  private reusableWorker: Worker | null = null;
  private workerBusy = false;

  private supportsWorkers(): boolean {
    return typeof Worker !== 'undefined';
  }

  private acquireWorker(): Worker | null {
    if (!this.supportsWorkers()) return null;
    if (this.reusableWorker && !this.workerBusy) {
      return this.reusableWorker;
    }
    try {
      const worker = new Worker(new URL('../../workers/scriptWorker.ts', import.meta.url), {
        type: 'module',
      });
      if (!this.reusableWorker) {
        this.reusableWorker = worker;
      }
      return worker;
    } catch {
      return null;
    }
  }

  private terminateWorker(worker: Worker) {
    try {
      worker.terminate();
    } catch {
      // ignore
    }
    if (this.reusableWorker === worker) {
      this.reusableWorker = null;
      this.workerBusy = false;
    }
  }

  public cancel(executionId: string): void {
    const entry = this.activeExecutions.get(executionId);
    if (!entry) return;

    entry.cancelToken.cancelled = true;
    if (entry.watchdog) clearTimeout(entry.watchdog);

    if (entry.worker) {
      try {
        entry.worker.postMessage({ type: 'cancel', executionId });
      } catch {
        // ignore
      }
      this.terminateWorker(entry.worker);
    }

    this.activeExecutions.delete(executionId);
    entry.resolve(
      emptyResult(entry.stage, {
        success: false,
        cancelled: true,
        error: {
          type: 'cancelled',
          message: 'Script execution cancelled.',
        },
      })
    );
  }

  public cancelAll(): void {
    for (const id of Array.from(this.activeExecutions.keys())) {
      this.cancel(id);
    }
  }

  public async execute(
    code: string,
    context: ScriptExecutionContext,
    executionId = `script-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  ): Promise<ScriptExecutionResult> {
    if (!code || !code.trim()) {
      return emptyResult(context.stage, { success: true });
    }

    const timeoutMs = Math.max(50, context.timeoutMs ?? 3000);
    const worker = this.acquireWorker();

    if (worker) {
      return new Promise<ScriptExecutionResult>((resolve) => {
        const isShared = worker === this.reusableWorker;
        if (isShared) this.workerBusy = true;

        const cancelToken = { cancelled: false };
        const startedAt = performance.now();

        const cleanup = () => {
          if (entry.watchdog) clearTimeout(entry.watchdog);
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          if (isShared && this.reusableWorker === worker) {
            this.workerBusy = false;
          }
          this.activeExecutions.delete(executionId);
        };

        const onMessage = (ev: MessageEvent) => {
          if (ev.data?.type === 'result' && ev.data.executionId === executionId) {
            cleanup();
            resolve(ev.data.result as ScriptExecutionResult);
          }
        };

        const onError = (err: ErrorEvent) => {
          cleanup();
          this.terminateWorker(worker);
          resolve(
            emptyResult(context.stage, {
              durationMs: Math.round(performance.now() - startedAt),
              error: {
                type: 'runtime',
                message: err.message || 'Worker execution failed',
              },
            })
          );
        };

        // Hard fallback deadline if worker hangs beyond QuickJS internal interrupt
        const watchdog = setTimeout(() => {
          if (!this.activeExecutions.has(executionId)) return;
          cleanup();
          this.terminateWorker(worker);
          resolve(
            emptyResult(context.stage, {
              durationMs: Math.round(performance.now() - startedAt),
              timedOut: true,
              error: {
                type: 'timeout',
                message: `Script execution timed out after ${timeoutMs}ms.`,
              },
            })
          );
        }, timeoutMs + 400);

        const entry: ActiveExecution = {
          executionId,
          stage: context.stage,
          cancelToken,
          resolve,
          worker,
          watchdog,
        };
        this.activeExecutions.set(executionId, entry);

        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage({
          type: 'execute',
          executionId,
          code,
          context,
        });
      });
    }

    // Fallback (Node / Vitest environments where Web Worker is unavailable):
    // Executes inside the exact same isolated QuickJS WASM sandbox.
    const cancelToken = { cancelled: false };
    return new Promise<ScriptExecutionResult>((resolve) => {
      const entry: ActiveExecution = {
        executionId,
        stage: context.stage,
        cancelToken,
        resolve,
      };
      this.activeExecutions.set(executionId, entry);

      executeInQuickJsSandbox(code, context, {
        isCancelled: () => cancelToken.cancelled,
      })
        .then((res) => {
          if (this.activeExecutions.has(executionId)) {
            this.activeExecutions.delete(executionId);
            resolve(res);
          }
        })
        .catch((err) => {
          if (this.activeExecutions.has(executionId)) {
            this.activeExecutions.delete(executionId);
            resolve(
              emptyResult(context.stage, {
                error: {
                  type: 'runtime',
                  message: err instanceof Error ? err.message : String(err),
                },
              })
            );
          }
        });
    });
  }
}

export const sandboxManager = new SandboxManager();
