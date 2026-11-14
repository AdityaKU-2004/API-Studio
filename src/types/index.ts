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

export interface Workspace {
  id: string;
  name: string;
  description: string;
}

export type SidebarSection =
  | 'collections'
  | 'history'
  | 'environments'
  | 'apis'
  | 'mock-servers'
  | 'monitors';
