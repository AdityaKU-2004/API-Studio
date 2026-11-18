export type AssertionCategory =
  | 'status'
  | 'responseTime'
  | 'body'
  | 'headers'
  | 'contentType';

export type AssertionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'exists'
  | 'notExists'
  | 'notEmpty'
  | 'between'
  | 'lessThan'
  | 'greaterThan'
  | 'is2xx'
  | 'is4xx'
  | 'is5xx'
  | 'arrayContains'
  | 'arrayLength'
  | 'isType'
  | 'matchesRegex';

export interface AssertionRule {
  id: string;
  name: string;
  group?: string;
  enabled: boolean;
  order: number;
  category: AssertionCategory;
  target?: string; // e.g. header name, JSON path like "data.items[0].id", etc.
  operator: AssertionOperator;
  expectedValue?: string;
  expectedValueMax?: string; // used for "between"
}

export interface AssertionResult {
  id: string;
  ruleId: string;
  name: string;
  group?: string;
  category: AssertionCategory;
  status: 'passed' | 'failed' | 'skipped';
  passed: boolean;
  expected?: string;
  actual?: string;
  error?: string;
  durationMs: number;
  source: 'assertion';
}

export interface AssertionConfiguration {
  id: string;
  name: string;
  description?: string;
  rules: AssertionRule[];
  createdAt: number;
  updatedAt: number;
}

export interface SavedJsonSchema {
  id: string;
  name: string;
  description?: string;
  schemaText: string;
  createdAt: number;
  updatedAt: number;
}

export interface SchemaValidationError {
  path: string;
  keyword: string;
  message: string;
  params?: Record<string, unknown>;
}

export interface SchemaValidationResult {
  valid: boolean;
  schemaName?: string;
  errorCount: number;
  errors: SchemaValidationError[];
  durationMs: number;
  schemaSyntaxError?: string;
}

export interface RequestSchemaConfig {
  enabled: boolean;
  schemaId?: string;
  inlineSchema?: string;
}

export interface RequestExecutionLogBundle {
  preRequestLogs: import('./scripting').ScriptConsoleEntry[];
  postResponseLogs: import('./scripting').ScriptConsoleEntry[];
  assertionResults: AssertionResult[];
  schemaValidation?: SchemaValidationResult;
}
