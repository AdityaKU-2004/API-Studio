import { JSONPath } from 'jsonpath-plus';
import {
  ApiRequest,
  ApiResponse,
  AutomationWorkflow,
  WorkflowExecutionReport,
  WorkflowStepConfig,
  WorkflowStepExecutionLog,
} from '../../types';
import { httpClient } from '../http/httpClient';
import { substituteVariables } from '../variables/variableResolver';
import { createDefaultRequest } from '../../stores/requestStore';

function evaluateConditionExpression(
  expr: string,
  vars: Record<string, string>,
  lastResponse: ApiResponse | null
): boolean {
  const expanded = substituteVariables(expr, {
    ...vars,
    status: lastResponse ? String(lastResponse.status) : '',
    body: lastResponse?.body || '',
  }).trim();

  const eqMatch = expanded.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
  if (eqMatch) {
    const left = eqMatch[1].trim().replace(/^['"]|['"]$/g, '');
    const op = eqMatch[2];
    const right = eqMatch[3].trim().replace(/^['"]|['"]$/g, '');
    return op === '==' ? left === right : left !== right;
  }

  const cmpMatch = expanded.match(/^(-?\d+(?:\.\d+)?)\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (cmpMatch) {
    const l = Number(cmpMatch[1]);
    const r = Number(cmpMatch[3]);
    switch (cmpMatch[2]) {
      case '>':
        return l > r;
      case '<':
        return l < r;
      case '>=':
        return l >= r;
      case '<=':
        return l <= r;
    }
  }

  return Boolean(expanded && expanded !== 'false' && expanded !== '0');
}

export async function executeWorkflow(params: {
  workflow: AutomationWorkflow;
  initialVariables: Record<string, string>;
  savedRequests: ApiRequest[];
  signal?: AbortSignal;
  onStepProgress?: (log: WorkflowStepExecutionLog) => void;
}): Promise<WorkflowExecutionReport> {
  const startedAt = Date.now();
  const runtimeVars: Record<string, string> = { ...params.initialVariables };
  const ephemeralSecretKeys = new Set<string>();
  const logs: WorkflowStepExecutionLog[] = [];
  let lastResponse: ApiResponse | null = null;
  let lastTransformedJson: unknown = null;

  const steps = params.workflow.steps;
  const stepIndexMap = new Map(steps.map((s, idx) => [s.id, idx]));

  let cursor = 0;
  let maxVisits = Math.max(steps.length * 4, 20);
  let stopped = false;

  while (cursor < steps.length && maxVisits > 0) {
    maxVisits--;
    if (params.signal?.aborted) {
      stopped = true;
      break;
    }

    const step: WorkflowStepConfig = steps[cursor];
    if (!step.enabled) {
      const skipLog: WorkflowStepExecutionLog = {
        stepId: step.id,
        stepName: step.name,
        type: step.type,
        status: 'skipped',
        startedAt: Date.now(),
        durationMs: 0,
        outputSummary: 'Step disabled',
      };
      logs.push(skipLog);
      params.onStepProgress?.(skipLog);
      cursor++;
      continue;
    }

    const stepStart = Date.now();
    let stepLog: WorkflowStepExecutionLog | null = null;
    let nextCursor = cursor + 1;

    const attempts = Math.max(1, (step.retryCount || 0) + 1);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (params.signal?.aborted) {
        stopped = true;
        break;
      }

      try {
        if (step.type === 'http-request' || step.type === 'graphql-request') {
          const baseReq = step.requestId
            ? params.savedRequests.find((r) => r.id === step.requestId)
            : undefined;
          const headers: Record<string, string> = step.headers || {};
          const fallbackBase = createDefaultRequest(
            step.name,
            step.method || (step.type === 'graphql-request' ? 'POST' : 'GET')
          );
          const reqObj: ApiRequest = baseReq
            ? {
                ...baseReq,
                method: step.method || baseReq.method,
                url: step.url || baseReq.url,
              }
            : {
                ...fallbackBase,
                id: `wf-req-${step.id}`,
                requestType: step.type === 'graphql-request' ? 'graphql' : 'http',
                url: step.url || '',
                headers: Object.entries(headers).map(([key, value], idx) => ({
                  id: `wfh-${idx}`,
                  key,
                  value,
                  description: '',
                  enabled: true,
                })),
                bodyType:
                  step.type === 'graphql-request' || step.body ? 'json' : 'none',
                rawBody:
                  step.type === 'graphql-request'
                    ? JSON.stringify({
                        query: step.graphqlQuery || '',
                        variables: JSON.parse(step.graphqlVariablesJson || '{}'),
                      })
                    : step.body || '',
                settings: {
                  ...fallbackBase.settings,
                  timeout: step.timeoutMs || 15000,
                },
                updatedAt: Date.now(),
              };

          const res = await httpClient.execute(reqObj, {
            tabId: `wf-${params.workflow.id}-${step.id}`,
            resolvedVariables: runtimeVars,
            timeoutMs: step.timeoutMs || 15000,
          });
          lastResponse = res;
          if (res.error || res.status === 0 || res.status >= 400) {
            throw new Error(res.error?.message || `HTTP ${res.status}`);
          }
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: `HTTP ${res.status} (${res.timeMs}ms)`,
            responseSnapshot: {
              status: res.status,
              statusText: res.statusText,
              timeMs: res.timeMs,
            },
          };
        } else if (step.type === 'set-variable') {
          const k = (step.variableKey || '').trim();
          if (!k) throw new Error('Variable key is required.');
          const val = substituteVariables(step.variableValue || '', runtimeVars);
          runtimeVars[k] = val;
          if (step.isEphemeralSecret) ephemeralSecretKeys.add(k);
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: step.isEphemeralSecret
              ? `Set ephemeral secret '${k}' (redacted)`
              : `Set '${k}' = '${val}'`,
          };
        } else if (step.type === 'read-variable') {
          const k = (step.variableKey || '').trim();
          const val = runtimeVars[k];
          if (val === undefined) throw new Error(`Variable '${k}' is undefined.`);
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: ephemeralSecretKeys.has(k)
              ? `Read secret '${k}' (redacted)`
              : `Read '${k}' = '${val}'`,
          };
        } else if (step.type === 'extract-response') {
          if (!lastResponse) throw new Error('No prior response available for extraction.');
          const parsedBody = JSON.parse(lastResponse.body);
          const extracted = JSONPath({ path: step.jsonPath || '$', json: parsedBody });
          const firstVal = Array.isArray(extracted) ? extracted[0] : extracted;
          if (firstVal === undefined) {
            throw new Error(`JSONPath '${step.jsonPath}' matched no value.`);
          }
          const targetKey = (step.variableKey || 'extracted').trim();
          const strVal =
            typeof firstVal === 'string' ? firstVal : JSON.stringify(firstVal);
          runtimeVars[targetKey] = strVal;
          if (step.isEphemeralSecret) ephemeralSecretKeys.add(targetKey);
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: step.isEphemeralSecret
              ? `Extracted secret into '${targetKey}'`
              : `Extracted '${targetKey}' = '${strVal.slice(0, 80)}'`,
          };
        } else if (step.type === 'json-transform') {
          const srcJson = lastResponse ? JSON.parse(lastResponse.body) : lastTransformedJson || {};
          lastTransformedJson = JSONPath({ path: step.jsonPath || '$', json: srcJson });
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: `Transformed JSON payload via '${step.jsonPath || '$'}'`,
          };
        } else if (step.type === 'condition') {
          const outcome = evaluateConditionExpression(
            step.conditionExpression || 'false',
            runtimeVars,
            lastResponse
          );
          if (outcome && step.thenStepId && stepIndexMap.has(step.thenStepId)) {
            nextCursor = stepIndexMap.get(step.thenStepId)!;
          } else if (!outcome && step.elseStepId && stepIndexMap.has(step.elseStepId)) {
            nextCursor = stepIndexMap.get(step.elseStepId)!;
          }
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: `Condition '${step.conditionExpression}' evaluated to ${outcome}`,
          };
        } else if (step.type === 'delay') {
          const ms = Math.max(0, Math.min(step.delayMs || 250, 60_000));
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, ms);
            params.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              resolve();
            });
          });
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: `Waited ${ms}ms`,
          };
        } else if (step.type === 'assertion') {
          if (!lastResponse) throw new Error('No response available to assert against.');
          const target = step.assertionTarget || 'status';
          const expected = substituteVariables(step.assertionExpected || '200', runtimeVars);
          if (target === 'status') {
            if (String(lastResponse.status) !== expected.trim()) {
              throw new Error(`Expected status ${expected}, got ${lastResponse.status}`);
            }
          } else if (!lastResponse.body.includes(expected)) {
            throw new Error(`Response body did not contain '${expected}'`);
          }
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: `Assertion (${target} == ${expected}) passed`,
          };
        } else if (step.type === 'run-collection') {
          const colRequests = params.savedRequests.filter(
            (r) => !step.collectionId || r.collectionId === step.collectionId
          );
          let okCount = 0;
          for (const cr of colRequests) {
            if (params.signal?.aborted) break;
            const res = await httpClient.execute(cr, {
              tabId: `wf-col-${cr.id}`,
              resolvedVariables: runtimeVars,
              timeoutMs: step.timeoutMs || 15000,
            });
            lastResponse = res;
            if (!res.error && res.status >= 200 && res.status < 400) okCount++;
          }
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: okCount === colRequests.length ? 'passed' : 'failed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: `Executed ${colRequests.length} requests (${okCount} passed)`,
          };
          if (okCount !== colRequests.length) {
            throw new Error(`Collection run had ${colRequests.length - okCount} failures`);
          }
        } else {
          // generate-report
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'passed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            outputSummary: `Prepared ${step.reportFormat || 'json'} workflow report with ${logs.length} completed entries`,
          };
        }
        break;
      } catch (err) {
        if (attempt === attempts) {
          stepLog = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'failed',
            startedAt: stepStart,
            durationMs: Date.now() - stepStart,
            errorMessage: err instanceof Error ? err.message : 'Workflow step error',
          };
        }
      }
    }

    if (stepLog) {
      logs.push(stepLog);
      params.onStepProgress?.(stepLog);
      if (stepLog.status === 'failed' && !step.continueOnError) {
        break;
      }
    }

    cursor = nextCursor;
  }

  // Clear ephemeral secrets cleanly after execution ends
  for (const sk of ephemeralSecretKeys) {
    delete runtimeVars[sk];
  }

  const completedAt = Date.now();
  const completedSteps = logs.filter((l) => l.status === 'passed').length;
  const failedSteps = logs.filter((l) => l.status === 'failed').length;
  const skippedSteps = logs.filter((l) => l.status === 'skipped').length;

  return {
    id: `wexec-${startedAt}`,
    workflowId: params.workflow.id,
    workflowName: params.workflow.name,
    status: stopped ? 'stopped' : failedSteps > 0 ? 'failed' : 'passed',
    startedAt,
    completedAt,
    durationMs: completedAt - startedAt,
    completedSteps,
    failedSteps,
    skippedSteps,
    logs,
  };
}
