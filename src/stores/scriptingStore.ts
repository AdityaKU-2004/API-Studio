import { create } from 'zustand';
import {
  ApiRequest,
  ApiResponse,
  ScriptConsoleEntry,
  ScriptExecutionResult,
  ScriptStage,
  ScriptTemplate,
} from '../types';
import { scriptTemplateRepository } from '../repositories/scriptTemplateRepository';
import { BUILT_IN_SCRIPT_TEMPLATES } from '../services/scripting/builtInTemplates';
import { buildScriptExecutionContext } from '../services/scripting/scriptContext';
import { scriptExecutor } from '../services/scripting/scriptExecutor';
import { persistScriptVariableUpdates } from '../services/scripting/variablePersistence';
import { useEnvironmentStore } from './environmentStore';
import { useVariableStore } from './variableStore';
import { useCollectionStore } from './collectionStore';

interface ScriptingState {
  templates: ScriptTemplate[];
  isLoadingTemplates: boolean;
  isExecutingByTab: Record<string, boolean>;
  activeScriptExecIds: Record<string, string>;
  lastResultByTabStage: Record<string, ScriptExecutionResult | undefined>;
  consoleLogsByTab: Record<string, ScriptConsoleEntry[]>;

  loadTemplates: () => Promise<void>;
  saveTemplate: (template: Omit<ScriptTemplate, 'createdAt' | 'updatedAt'> & Partial<Pick<ScriptTemplate, 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  runScriptManually: (
    tabId: string,
    stage: ScriptStage,
    request: ApiRequest,
    response?: ApiResponse | null
  ) => Promise<ScriptExecutionResult>;
  cancelManualScript: (tabId: string) => void;
  recordPipelineLogs: (tabId: string, logs: ScriptConsoleEntry[], preRes?: ScriptExecutionResult, postRes?: ScriptExecutionResult) => void;
  clearTabConsole: (tabId: string) => void;
}

export const useScriptingStore = create<ScriptingState>((set, get) => ({
  templates: BUILT_IN_SCRIPT_TEMPLATES,
  isLoadingTemplates: false,
  isExecutingByTab: {},
  activeScriptExecIds: {},
  lastResultByTabStage: {},
  consoleLogsByTab: {},

  loadTemplates: async () => {
    set({ isLoadingTemplates: true });
    try {
      const list = await scriptTemplateRepository.getAll();
      set({ templates: list, isLoadingTemplates: false });
    } catch {
      set({ templates: BUILT_IN_SCRIPT_TEMPLATES, isLoadingTemplates: false });
    }
  },

  saveTemplate: async (tpl) => {
    const now = Date.now();
    const full: ScriptTemplate = {
      ...tpl,
      createdAt: tpl.createdAt || now,
      updatedAt: now,
    };
    await scriptTemplateRepository.save(full);
    await get().loadTemplates();
  },

  deleteTemplate: async (id) => {
    await scriptTemplateRepository.delete(id);
    await get().loadTemplates();
  },

  runScriptManually: async (tabId, stage, request, response) => {
    const execId = `manual-${tabId}-${Date.now()}`;
    set((s) => ({
      isExecutingByTab: { ...s.isExecutingByTab, [tabId]: true },
      activeScriptExecIds: { ...s.activeScriptExecIds, [tabId]: execId },
    }));

    const envStore = useEnvironmentStore.getState();
    const activeEnv = envStore.environments.find((e) => e.id === envStore.activeEnvironmentId);
    const globVars = useVariableStore.getState().globalVariables;
    const colVars = request.collectionId
      ? useCollectionStore.getState().collections.find((c) => c.id === request.collectionId)?.variables || []
      : [];

    const code =
      stage === 'pre-request'
        ? request.scripts?.preRequest?.script ?? request.preRequestScript ?? ''
        : request.scripts?.postResponse?.script ?? request.testScript ?? '';

    const ctx = buildScriptExecutionContext({
      stage,
      request,
      response: response || undefined,
      environmentVariables: activeEnv?.variables || [],
      collectionVariables: colVars,
      globalVariables: globVars,
      localVariables: request.variables || [],
      timeoutMs: 3000,
    });

    const result = await scriptExecutor.execute(code, ctx, execId);

    // Apply variable updates persistently
    await persistScriptVariableUpdates(result.variableUpdates, {
      environmentId: envStore.activeEnvironmentId,
      collectionId: request.collectionId,
    });

    set((s) => ({
      isExecutingByTab: { ...s.isExecutingByTab, [tabId]: false },
      lastResultByTabStage: {
        ...s.lastResultByTabStage,
        [`${tabId}:${stage}`]: result,
      },
      consoleLogsByTab: {
        ...s.consoleLogsByTab,
        [tabId]: [...(s.consoleLogsByTab[tabId] || []), ...result.logs].slice(-200),
      },
    }));

    return result;
  },

  cancelManualScript: (tabId) => {
    const execId = get().activeScriptExecIds[tabId];
    if (execId) {
      scriptExecutor.cancel(execId);
    }
    set((s) => ({
      isExecutingByTab: { ...s.isExecutingByTab, [tabId]: false },
    }));
  },

  recordPipelineLogs: (tabId, logs, preRes, postRes) => {
    set((s) => ({
      lastResultByTabStage: {
        ...s.lastResultByTabStage,
        ...(preRes ? { [`${tabId}:pre-request`]: preRes } : {}),
        ...(postRes ? { [`${tabId}:post-response`]: postRes } : {}),
      },
      consoleLogsByTab: {
        ...s.consoleLogsByTab,
        [tabId]: logs,
      },
    }));
  },

  clearTabConsole: (tabId) => {
    set((s) => ({
      consoleLogsByTab: { ...s.consoleLogsByTab, [tabId]: [] },
    }));
  },
}));
