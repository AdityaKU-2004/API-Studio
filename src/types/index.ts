export * from './auth';
export * from './body';
export * from './request';

export interface ResponseCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  timestamp: number;
  headers: Record<string, string>;
  cookies: ResponseCookie[];
  body: string;
  contentType: string;
  tests: TestResult[];
}

export interface CollectionItem {
  id: string;
  name: string;
  type: 'collection' | 'folder' | 'request';
  parentId?: string | null;
  requestId?: string;
  request?: import('./request').ApiRequest;
  auth?: import('./auth').AuthConfig;
  children?: CollectionItem[];
  isExpanded?: boolean;
  description?: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  initialValue: string;
  currentValue: string;
  description: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  isDefault?: boolean;
  variables: EnvironmentVariable[];
}

export interface HistoryItem {
  id: string;
  method: import('./request').HttpMethod;
  url: string;
  status: number;
  statusText: string;
  timeMs: number;
  timestamp: number;
  request: import('./request').ApiRequest;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
}

export type SidebarSection = 'collections' | 'history' | 'environments' | 'apis' | 'mock-servers' | 'monitors';
