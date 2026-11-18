import { HttpMethod } from './request';
import { AssertionRule, AssertionResult, SchemaValidationResult } from './testing';
import { ScriptConsoleEntry, ScriptExecutionError } from './scripting';
import { TestResult } from './response';

export type RunnerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'error';

export type FailureHandlingMode = 'stop' | 'continue';

export type IterationDataFormat = 'json' | 'csv';

export type IterationDataRow = Record<string, string>;

export interface RunnerRequestSelection {
  requestId: string;
  collectionId?: string;
  folderId?: string;
  name: string;
  method: HttpMethod;
  url: string;
  enabled: boolean;
  order: number;
}

export interface RunnerConfig {
  id?: string;
  name?: string;
  collectionId?: string;
  folderId?: string;
  requests: RunnerRequestSelection[];
  environmentId: string | null;
  iterations: number;
  delayMs: number;
  failureMode: FailureHandlingMode;
  timeoutMs: number;
  iterationData: IterationDataRow[];
  iterationDataFormat?: IterationDataFormat;
  extraAssertions?: AssertionRule[];
}

export interface RunnerRequestExecutionResult {
  id: string;
  iteration: number;
  order: number;
  requestId: string;
  requestName: string;
  method: HttpMethod;
  resolvedUrl: string;
  status: number;
  statusText: string;
  responseTimeMs: number;
  sizeBytes: number;
  passed: boolean;
  failedReason?: string;
  scriptError?: ScriptExecutionError;
  tests: TestResult[];
  assertions: AssertionResult[];
  schemaValidation?: SchemaValidationResult;
  consoleLogs: ScriptConsoleEntry[];
  iterationDataRow?: IterationDataRow;
  timestamp: number;
}

export interface RunnerProgressState {
  runId: string;
  status: RunnerStatus;
  totalExecutions: number;
  completedExecutions: number;
  currentIteration: number;
  totalIterations: number;
  currentRequestIndex: number;
  currentRequestName?: string;
  passedRequests: number;
  failedRequests: number;
  passedAssertions: number;
  failedAssertions: number;
  skippedAssertions: number;
  elapsedMs: number;
  startedAt: number;
  finishedAt?: number;
  percentage: number;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  folder?: string;
  collectionId?: string;
  requestIds: string[];
  environmentId: string | null;
  assertions: AssertionRule[];
  iterations: number;
  delayMs: number;
  failureMode: FailureHandlingMode;
  timeoutMs: number;
  iterationData: IterationDataRow[];
  lastRunReportId?: string;
  lastRunStatus?: 'passed' | 'failed' | 'partial';
  lastRunAt?: number;
  createdAt: number;
  updatedAt: number;
}
