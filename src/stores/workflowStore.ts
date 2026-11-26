import { create } from 'zustand';
import {
  ApiRequest,
  AutomationWorkflow,
  WorkflowExecutionReport,
  WorkflowStepExecutionLog,
} from '../types';
import { db } from '../database/database';
import { executeWorkflow } from '../services/workflows/workflowEngine';
import { useEnvironmentStore } from './environmentStore';

interface WorkflowState {
  workflows: AutomationWorkflow[];
  executions: WorkflowExecutionReport[];
  activeWorkflowId: string | null;
  liveLogs: WorkflowStepExecutionLog[];
  isRunning: boolean;
  abortController: AbortController | null;

  loadWorkflows: () => Promise<void>;
  selectWorkflow: (id: string) => void;
  saveWorkflow: (workflow: AutomationWorkflow) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  runWorkflow: (
    workflow: AutomationWorkflow,
    savedRequests: ApiRequest[]
  ) => Promise<WorkflowExecutionReport>;
  stopWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  executions: [],
  activeWorkflowId: null,
  liveLogs: [],
  isRunning: false,
  abortController: null,

  loadWorkflows: async () => {
    const [workflows, executions] = await Promise.all([
      db.automationWorkflows.orderBy('updatedAt').reverse().toArray(),
      db.workflowExecutions.orderBy('startedAt').reverse().toArray(),
    ]);
    set({
      workflows,
      executions,
      activeWorkflowId: get().activeWorkflowId || workflows[0]?.id || null,
    });
  },

  selectWorkflow: (id) => set({ activeWorkflowId: id }),

  saveWorkflow: async (workflow) => {
    const saved = { ...workflow, updatedAt: Date.now() };
    await db.automationWorkflows.put(saved);
    await get().loadWorkflows();
    set({ activeWorkflowId: saved.id });
  },

  deleteWorkflow: async (id) => {
    await db.automationWorkflows.delete(id);
    await db.workflowExecutions.where('workflowId').equals(id).delete();
    await get().loadWorkflows();
  },

  runWorkflow: async (workflow, savedRequests) => {
    const abortController = new AbortController();
    const initialVariables = useEnvironmentStore.getState().getResolvedVariables();
    set({ isRunning: true, liveLogs: [], abortController });

    try {
      const report = await executeWorkflow({
        workflow,
        initialVariables,
        savedRequests,
        signal: abortController.signal,
        onStepProgress: (log) => {
          set((s) => ({ liveLogs: [...s.liveLogs, log] }));
        },
      });
      await db.workflowExecutions.put(report);
      set((s) => ({
        isRunning: false,
        abortController: null,
        executions: [report, ...s.executions],
      }));
      return report;
    } catch (err) {
      set({ isRunning: false, abortController: null });
      throw err;
    }
  },

  stopWorkflow: () => {
    get().abortController?.abort();
  },
}));
