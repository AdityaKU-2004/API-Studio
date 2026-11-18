import { AuthConfig } from './auth';
import { BodyType, RequestBody, FormDataItem } from './body';
import { AssertionRule, RequestSchemaConfig } from './testing';
import { ScriptFailurePolicy } from './scripting';
import { EnvironmentVariable } from './environment';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface RequestScripts {
  preRequest: {
    script: string;
    enabled: boolean;
    failurePolicy?: ScriptFailurePolicy;
  };
  postResponse: {
    script: string;
    enabled: boolean;
    failurePolicy?: ScriptFailurePolicy;
  };
}

export interface RequestSettings {
  // General
  timeout: number;
  followRedirects: boolean;
  maxRedirects: number;
  autoEncodeUrl: boolean;
  // Security
  sslVerification: boolean;
  allowInsecureCertificates: boolean;
  // Connection
  httpVersion: 'auto' | 'http1.1' | 'http2';
  connectionTimeout: number;
  keepAlive: boolean;
  // Advanced
  disableCache: boolean;
  followAuthRedirects: boolean;
  customUserAgent: string;
}

export interface RequestDefinition {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValueItem[];
  headers: KeyValueItem[];
  auth: AuthConfig;
  body: RequestBody;
  scripts: RequestScripts;
  settings: RequestSettings;
  assertions?: AssertionRule[];
  schemaValidation?: RequestSchemaConfig;
  variables?: EnvironmentVariable[];
  createdAt: number;
  updatedAt: number;
  collectionId?: string;
  folderId?: string;
  order?: number;
}

// Backward compatible alias with Phase 1
export interface ApiRequest extends RequestDefinition {
  bodyType: BodyType;
  rawBody: string;
  formData: FormDataItem[];
  urlEncoded: KeyValueItem[];
  preRequestScript: string;
  testScript: string;
}

export interface ValidationError {
  field: 'url' | 'params' | 'headers' | 'auth' | 'body' | 'general';
  message: string;
  severity: 'error' | 'warning';
}

export interface RequestTab {
  id: string;
  requestId?: string;
  title: string;
  method: HttpMethod;
  isDirty?: boolean;
  request: ApiRequest;
}
