import { Environment } from '../../types';
import { initialEnvironments } from '../../data/mockData';

export interface IEnvironmentService {
  getEnvironments(): Promise<Environment[]>;
  saveEnvironment(environment: Environment): Promise<void>;
  deleteEnvironment(id: string): Promise<void>;
}

export class MockEnvironmentService implements IEnvironmentService {
  private environments: Environment[] = [...initialEnvironments];

  async getEnvironments(): Promise<Environment[]> {
    return JSON.parse(JSON.stringify(this.environments));
  }

  async saveEnvironment(env: Environment): Promise<void> {
    const idx = this.environments.findIndex((e) => e.id === env.id);
    if (idx >= 0) {
      this.environments[idx] = env;
    } else {
      this.environments.push(env);
    }
  }

  async deleteEnvironment(id: string): Promise<void> {
    this.environments = this.environments.filter((e) => e.id !== id);
  }
}

export const environmentService = new MockEnvironmentService();
