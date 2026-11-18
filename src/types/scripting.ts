export type ScriptStage = 'pre-request' | 'post-response' | 'test';

export type ScriptFailurePolicy = 'halt' | 'continue';

export type ScriptConsoleLevel = 'log' | 'info' | 'warn' | 'error';

export interface ScriptConsoleEntry {
  id: string;
  level: ScriptConsoleLevel;
  message: string;
  timestamp: number;
  stage: ScriptStage;
}

export interface ScriptExecutionError {
  type: 'syntax' | 'runtime' | 'timeout' | 'memory' | 'cancelled' | 'security';
  message: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface ScriptVariableUpdates {
  environment: Record<string, string | null>; // null means unset
  collectionVariables: Record<string, string | null>;
  globals: Record<string, string | null>;
  variables: Record<string, string | null>; // request/local scope
}

export interface SafeScriptRequestContext {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
}

export interface SafeScriptResponseContext {
  code: number;
  status: string;
  responseTime: number;
  headers: Record<string, string>;
  body: string;
  size: number;
}

export interface ScriptExecutionContext {
  stage: ScriptStage;
  requestId?: string;
  executionId?: string;
  timeoutMs?: number;
  memoryLimitBytes?: number;
  request: SafeScriptRequestContext;
  response?: SafeScriptResponseContext;
  environmentVariables: Record<string, string>;
  collectionVariables: Record<string, string>;
  globalVariables: Record<string, string>;
  localVariables: Record<string, string>;
  iterationData?: Record<string, string>;
  secretValues?: string[];
  allowSecretLogging?: boolean;
}

export interface ScriptTestOutcome {
  id: string;
  name: string;
  passed: boolean;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  expected?: string;
  actual?: string;
  durationMs: number;
  source: 'script';
}

export interface ScriptExecutionResult {
  success: boolean;
  stage: ScriptStage;
  durationMs: number;
  logs: ScriptConsoleEntry[];
  tests: ScriptTestOutcome[];
  variableUpdates: ScriptVariableUpdates;
  error?: ScriptExecutionError;
  cancelled?: boolean;
  timedOut?: boolean;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'pre-request' | 'testing' | 'variables' | 'security' | 'validation';
  stage: ScriptStage;
  code: string;
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
}
