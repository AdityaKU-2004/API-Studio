import React, { useMemo, useState } from 'react';
import {
  Workflow,
  Play,
  Square,
  Plus,
  Trash2,
  Download,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  ApiRequest,
  AutomationWorkflow,
  CollectionItem,
  HttpMethod,
  WorkflowStepConfig,
  WorkflowStepType,
} from '../../types';
import { useCollectionStore } from '../../stores/collectionStore';
import { useWorkflowStore } from '../../stores/workflowStore';

function collectAllRequests(items: CollectionItem[]): ApiRequest[] {
  const res: ApiRequest[] = [];
  for (const it of items) {
    if (it.type === 'request' && it.request) res.push(it.request);
    if (it.children) res.push(...collectAllRequests(it.children));
  }
  return res;
}

const STEP_TYPES: Array<{ value: WorkflowStepType; label: string }> = [
  { value: 'http-request', label: 'HTTP Request' },
  { value: 'graphql-request', label: 'GraphQL Request' },
  { value: 'extract-response', label: 'Extract Response (JSONPath)' },
  { value: 'set-variable', label: 'Set Variable' },
  { value: 'read-variable', label: 'Read Variable' },
  { value: 'condition', label: 'Conditional Branch' },
  { value: 'assertion', label: 'Response Assertion' },
  { value: 'json-transform', label: 'JSON Transform' },
  { value: 'delay', label: 'Delay (Wait)' },
  { value: 'run-collection', label: 'Run Collection' },
  { value: 'generate-report', label: 'Generate Report' },
];

export const WorkflowBuilderView: React.FC = () => {
  const { collections } = useCollectionStore();
  const {
    workflows,
    executions,
    activeWorkflowId,
    liveLogs,
    isRunning,
    selectWorkflow,
    saveWorkflow,
    deleteWorkflow,
    runWorkflow,
    stopWorkflow,
  } = useWorkflowStore();

  const savedRequests = useMemo(() => collectAllRequests(collections), [collections]);
  const [draftName, setDraftName] = useState('API Verification Flow');
  const [draftDesc, setDraftDesc] = useState('Sequential API chaining workflow');
  const [steps, setSteps] = useState<WorkflowStepConfig[]>([
    {
      id: 'st-1',
      name: 'Fetch Sample Resource',
      type: 'http-request',
      enabled: true,
      timeoutMs: 10000,
      retryCount: 0,
      continueOnError: false,
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
    },
    {
      id: 'st-2',
      name: 'Verify 200 Status',
      type: 'assertion',
      enabled: true,
      timeoutMs: 5000,
      retryCount: 0,
      continueOnError: false,
      assertionTarget: 'status',
      assertionExpected: '200',
    },
  ]);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || null;
  const activeExecution =
    executions.find((ex) => ex.workflowId === (activeWorkflow?.id || '')) || executions[0] || null;
  const displayLogs = isRunning ? liveLogs : activeExecution?.logs || [];

  const handleLoadIntoEditor = (wf: AutomationWorkflow) => {
    selectWorkflow(wf.id);
    setDraftName(wf.name);
    setDraftDesc(wf.description);
    setSteps(wf.steps);
  };

  const handleAddStep = (type: WorkflowStepType) => {
    const step: WorkflowStepConfig = {
      id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: STEP_TYPES.find((t) => t.value === type)?.label || type,
      type,
      enabled: true,
      timeoutMs: 10000,
      retryCount: 0,
      continueOnError: false,
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      delayMs: 300,
      assertionTarget: 'status',
      assertionExpected: '200',
    };
    setSteps((prev) => [...prev, step]);
  };

  const updateStep = (id: string, updates: Partial<WorkflowStepConfig>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const moveStep = (index: number, delta: number) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= steps.length) return;
    const copy = [...steps];
    const [removed] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, removed);
    setSteps(copy);
  };

  const buildCurrentWorkflow = (): AutomationWorkflow => ({
    id: activeWorkflow?.id || `wf-${Date.now()}`,
    name: draftName.trim() || 'Automation Workflow',
    description: draftDesc,
    steps,
    createdAt: activeWorkflow?.createdAt || Date.now(),
    updatedAt: Date.now(),
  });

  const handleSave = async () => {
    await saveWorkflow(buildCurrentWorkflow());
  };

  const handleRun = async () => {
    const wf = buildCurrentWorkflow();
    await saveWorkflow(wf);
    await runWorkflow(wf, savedRequests);
  };

  const exportLatestExecution = () => {
    if (!activeExecution) return;
    const blob = new Blob([JSON.stringify(activeExecution, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${activeExecution.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Workflow className="w-4 h-4 text-cyan-500" />
          <div>
            <h1 className="text-sm font-semibold">API Automation Workflows</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sequential multi-step request chaining, variable extraction, conditional branching &amp; assertions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => void handleSave()}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
          >
            Save Workflow
          </button>
          {activeExecution && (
            <button
              type="button"
              onClick={exportLatestExecution}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          )}
          {isRunning ? (
            <button
              type="button"
              onClick={stopWorkflow}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleRun()}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Execute Workflow</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Workflows & Palette */}
        <div className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] p-4 overflow-y-auto space-y-4 shrink-0 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">Workflow Name</label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div className="space-y-1">
            <div className="font-semibold">Add Step</div>
            <div className="grid grid-cols-1 gap-1">
              {STEP_TYPES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => handleAddStep(st.value)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-cyan-500 shrink-0" />
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-semibold">Saved Workflows ({workflows.length})</div>
            {workflows.map((wf) => (
              <div
                key={wf.id}
                onClick={() => handleLoadIntoEditor(wf)}
                className="flex items-center justify-between p-2 rounded border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/40"
              >
                <span className="truncate font-medium">{wf.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteWorkflow(wf.id);
                  }}
                  className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Center Steps Editor & Right Execution Logs */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">#{idx + 1}</span>
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => updateStep(step.id, { name: e.target.value })}
                      className="font-semibold bg-transparent border-b border-transparent focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-500">({step.type})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(idx, -1)}
                      className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(idx, 1)}
                      className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSteps((p) => p.filter((s) => s.id !== step.id))}
                      className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {(step.type === 'http-request' || step.type === 'graphql-request') && (
                  <div className="grid grid-cols-4 gap-2">
                    <select
                      value={step.method || 'GET'}
                      onChange={(e) => updateStep(step.id, { method: e.target.value as HttpMethod })}
                      className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                    >
                      {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={step.url || ''}
                      onChange={(e) => updateStep(step.id, { url: e.target.value })}
                      placeholder="https://api.example.com/resource"
                      className="col-span-3 px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                    />
                  </div>
                )}

                {(step.type === 'set-variable' || step.type === 'read-variable' || step.type === 'extract-response') && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={step.variableKey || ''}
                      onChange={(e) => updateStep(step.id, { variableKey: e.target.value })}
                      placeholder="Variable key"
                      className="px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                    />
                    {step.type === 'extract-response' ? (
                      <input
                        type="text"
                        value={step.jsonPath || ''}
                        onChange={(e) => updateStep(step.id, { jsonPath: e.target.value })}
                        placeholder="JSONPath (e.g. $.data.id)"
                        className="px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                      />
                    ) : step.type === 'set-variable' ? (
                      <input
                        type="text"
                        value={step.variableValue || ''}
                        onChange={(e) => updateStep(step.id, { variableValue: e.target.value })}
                        placeholder="Value"
                        className="px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                      />
                    ) : null}
                  </div>
                )}

                {step.type === 'condition' && (
                  <input
                    type="text"
                    value={step.conditionExpression || ''}
                    onChange={(e) => updateStep(step.id, { conditionExpression: e.target.value })}
                    placeholder="{{status}} == 200"
                    className="w-full px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                )}

                {step.type === 'assertion' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={step.assertionTarget || 'status'}
                      onChange={(e) => updateStep(step.id, { assertionTarget: e.target.value })}
                      className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="status">HTTP Status</option>
                      <option value="body">Response Body Contains</option>
                    </select>
                    <input
                      type="text"
                      value={step.assertionExpected || ''}
                      onChange={(e) => updateStep(step.id, { assertionExpected: e.target.value })}
                      placeholder="200"
                      className="px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                    />
                  </div>
                )}

                {step.type === 'delay' && (
                  <input
                    type="number"
                    min={0}
                    value={step.delayMs || 300}
                    onChange={(e) => updateStep(step.id, { delayMs: Number(e.target.value) })}
                    className="w-32 px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
                  />
                )}

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={(e) => updateStep(step.id, { enabled: e.target.checked })}
                    />
                    <span>Enabled</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.continueOnError}
                      onChange={(e) => updateStep(step.id, { continueOnError: e.target.checked })}
                    />
                    <span>Continue on error</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>Retries:</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={step.retryCount}
                      onChange={(e) => updateStep(step.id, { retryCount: Number(e.target.value) })}
                      className="w-12 px-1 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] p-4 overflow-y-auto text-xs space-y-3 shrink-0">
            <div className="font-semibold">Execution Output</div>
            {activeExecution && (
              <div className="p-2.5 rounded border border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                Status: {activeExecution.status} · {activeExecution.completedSteps} passed ·{' '}
                {activeExecution.failedSteps} failed · {activeExecution.durationMs}ms
              </div>
            )}
            <div className="space-y-2">
              {displayLogs.map((log, i) => (
                <div
                  key={`${log.stepId}-${i}`}
                  className="p-2.5 rounded border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex justify-between font-medium">
                    <span>{log.stepName}</span>
                    <span
                      className={
                        log.status === 'passed'
                          ? 'text-emerald-500'
                          : log.status === 'failed'
                          ? 'text-red-500'
                          : 'text-slate-400'
                      }
                    >
                      {log.status} ({log.durationMs}ms)
                    </span>
                  </div>
                  {log.outputSummary && (
                    <div className="text-slate-500 mt-1 font-mono">{log.outputSummary}</div>
                  )}
                  {log.errorMessage && (
                    <div className="text-red-500 mt-1 font-mono">{log.errorMessage}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
