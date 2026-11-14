import { CollectionDefinition, FolderDefinition } from './collection';
import { ApiRequest } from './request';
import { Environment, EnvironmentVariable } from './environment';
import { HistoryItem } from './history';

export interface ApplicationSettings {
  id: string;
  theme: 'dark' | 'light';
  sidebarWidth: number;
  splitRatio: number;
  activeWorkspaceId: string;
  activeEnvironmentId: string | null;
  historyRetentionLimit: number;
  retainResponseBodiesInHistory: boolean;
  defaultTimeout: number;
  updatedAt: number;
}

export interface BackupMetadata {
  backupVersion: number;
  appVersion: string;
  appName: string;
  exportedAt: string;
  timestamp: number;
  schemaVersion: number;
  includesSecrets: boolean;
  counts: {
    collections: number;
    folders: number;
    requests: number;
    environments: number;
    globalVariables: number;
    history: number;
  };
}

export interface BackupData {
  metadata: BackupMetadata;
  collections: CollectionDefinition[];
  folders: FolderDefinition[];
  requests: ApiRequest[];
  environments: Environment[];
  globalVariables: EnvironmentVariable[];
  settings?: ApplicationSettings;
  history?: HistoryItem[];
}
