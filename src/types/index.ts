export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

export interface AuthConfig {
  type: AuthType;
  bearer?: {
    token: string;
    prefix?: string;
  };
  basic?: {
    username: string;
    password: string;
  };
  apikey?: {
    key: string;
    value: string;
    addTo: 'header' | 'query';
  };
  oauth2?: {
    grantType: 'authorization_code' | 'client_credentials' | 'implicit';
    authUrl: string;
    accessTokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope: string;
    token?: string;
  };
}

export type BodyType = 'none' | 'json' | 'text' | 'xml' | 'form-data' | 'x-www-form-urlencoded';

export interface FormDataItem {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'file';
  description?: string;
  enabled: boolean;
}

export interface RequestSettings {
  timeout: number;
  followRedirects: boolean;
  sslVerification: boolean;
  autoEncodeUrl: boolean;
}

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValueItem[];
  headers: KeyValueItem[];
  auth: AuthConfig;
  bodyType: BodyType;
  rawBody: string;
  formData: FormDataItem[];
  urlEncoded: KeyValueItem[];
  preRequestScript: string;
  testScript: string;
  settings: RequestSettings;
  collectionId?: string;
  folderId?: string;
}

export interface RequestTab {
  id: string;
  requestId?: string;
  title: string;
  method: HttpMethod;
  isDirty?: boolean;
  request: ApiRequest;
}

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
  request?: ApiRequest;
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
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  timeMs: number;
  timestamp: number;
  request: ApiRequest;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
}

export type SidebarSection = 'collections' | 'history' | 'environments' | 'apis' | 'mock-servers' | 'monitors';
