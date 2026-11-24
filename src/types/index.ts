export * from './auth';
export * from './body';
export * from './request';
export * from './http';
export * from './response';
export * from './execution';
export * from './collection';
export * from './environment';
export * from './variable';
export * from './history';
export * from './database';
export * from './scripting';
export * from './testing';
export * from './runner';
export * from './testReport';
export * from './protocols';
export * from './comparison';
export * from './developerTools';
export * from './diagnostics';
export * from './desktop';
export * from './phase8';

export interface Workspace {
  id: string;
  name: string;
  description: string;
}

export type SidebarSection =
  | 'collections'
  | 'history'
  | 'environments'
  | 'runner'
  | 'suites'
  | 'reports'
  | 'templates'
  | 'schemas'
  | 'comparison'
  | 'devtools'
  | 'apis'
  | 'spec-editor'
  | 'api-docs'
  | 'api-versions'
  | 'contract-tests'
  | 'mock-servers'
  | 'git'
  | 'workspaces'
  | 'monitors';
