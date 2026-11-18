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
  | 'apis'
  | 'mock-servers'
  | 'monitors';
