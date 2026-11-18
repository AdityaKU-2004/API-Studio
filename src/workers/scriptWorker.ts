import { executeInQuickJsSandbox } from '../services/scripting/quickJsSandbox';
import { ScriptExecutionContext } from '../types';

interface ExecuteWorkerMessage {
  type: 'execute';
  executionId: string;
  code: string;
  context: ScriptExecutionContext;
}

interface CancelWorkerMessage {
  type: 'cancel';
  executionId: string;
}

type IncomingWorkerMessage = ExecuteWorkerMessage | CancelWorkerMessage;

const cancelledIds = new Set<string>();

self.onmessage = async (event: MessageEvent<IncomingWorkerMessage>) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'cancel') {
    cancelledIds.add(data.executionId);
    return;
  }

  if (data.type === 'execute') {
    const { executionId, code, context } = data;
    cancelledIds.delete(executionId);

    try {
      const result = await executeInQuickJsSandbox(code, context, {
        isCancelled: () => cancelledIds.has(executionId),
      });
      cancelledIds.delete(executionId);
      self.postMessage({ type: 'result', executionId, result });
    } catch (err) {
      cancelledIds.delete(executionId);
      self.postMessage({
        type: 'result',
        executionId,
        result: {
          success: false,
          stage: context.stage,
          durationMs: 0,
          logs: [],
          tests: [],
          variableUpdates: { environment: {}, collectionVariables: {}, globals: {}, variables: {} },
          error: {
            type: 'runtime',
            message: err instanceof Error ? err.message : String(err),
          },
        },
      });
    }
  }
};
