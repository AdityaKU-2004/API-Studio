import { EnvironmentProfileType } from './phase9';

export interface EnvironmentVariable {
  id: string;
  key: string;
  initialValue: string;
  currentValue: string;
  description: string;
  enabled: boolean;
  isSecret?: boolean;
  secret?: boolean; // alias
  scope?: 'global' | 'environment' | 'collection' | 'folder' | 'request';
}

export interface Environment {
  id: string;
  name: string;
  profileType?: EnvironmentProfileType;
  description?: string;
  isDefault?: boolean;
  variables: EnvironmentVariable[];
  order?: number;
  createdAt?: number;
  updatedAt?: number;
}
