import { EnvironmentVariable } from './environment';

export type VariableScope = 'global' | 'collection' | 'folder' | 'environment' | 'request';

export interface GlobalVariable extends EnvironmentVariable {
  scope: 'global';
}

export interface VariableResolutionResult {
  original: string;
  resolved: string;
  unresolvedVariables: string[];
  circularVariables: string[];
  resolvedMap: Record<string, { value: string; scope: VariableScope }>;
}

export interface ScopedVariableContext {
  globalVariables?: EnvironmentVariable[];
  globalVars?: EnvironmentVariable[];
  collectionVariables?: EnvironmentVariable[];
  collectionVars?: EnvironmentVariable[];
  folderVariables?: EnvironmentVariable[];
  folderVars?: EnvironmentVariable[];
  environmentVariables?: EnvironmentVariable[];
  environmentVars?: EnvironmentVariable[];
  requestVariables?: EnvironmentVariable[];
  requestVars?: EnvironmentVariable[];
  [key: string]: any;
}
