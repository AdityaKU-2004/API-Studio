import { AuthConfig } from './auth';
import { KeyValueItem, ApiRequest } from './request';
import { EnvironmentVariable } from './environment';

export interface CollectionDefinition {
  id: string;
  name: string;
  description?: string;
  color?: string; // hex or color token (cyan, blue, emerald, amber, purple, rose)
  icon?: string; // icon identifier (folder, globe, box, database, shield, zap, lock)
  auth?: AuthConfig;
  headers?: KeyValueItem[];
  variables?: EnvironmentVariable[];
  order?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FolderDefinition {
  id: string;
  collectionId: string;
  parentId?: string | null;
  name: string;
  description?: string;
  auth?: AuthConfig;
  headers?: KeyValueItem[];
  variables?: EnvironmentVariable[];
  order?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionItem {
  id: string;
  name: string;
  type: 'collection' | 'folder' | 'request';
  collectionId?: string;
  parentId?: string | null;
  requestId?: string;
  request?: ApiRequest;
  auth?: AuthConfig;
  headers?: KeyValueItem[];
  variables?: EnvironmentVariable[];
  color?: string;
  icon?: string;
  description?: string;
  children?: CollectionItem[];
  order?: number;
  isExpanded?: boolean;
}
