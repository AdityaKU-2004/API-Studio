import { ApiRequest, ApiResponse, RequestExecutionOptions } from '../../types';
import { getHttpTransport } from '../runtime/transportFactory';

/**
 * Standardized HTTP execution contract.
 * Routes automatically to Browser Fetch API in browser mode and
 * native Tauri/Rust reqwest engine in desktop mode.
 */
export interface HttpExecutionService {
  execute(request: ApiRequest, options?: RequestExecutionOptions): Promise<ApiResponse>;
  cancel(tabId: string): void;
  isExecuting(tabId: string): boolean;
}

class RuntimeAwareHttpClient implements HttpExecutionService {
  public execute(request: ApiRequest, options?: RequestExecutionOptions): Promise<ApiResponse> {
    return getHttpTransport().execute(request, options);
  }

  public cancel(tabId: string): void {
    getHttpTransport().cancel(tabId);
  }

  public isExecuting(tabId: string): boolean {
    return getHttpTransport().isExecuting(tabId);
  }
}

export const httpClient: HttpExecutionService = new RuntimeAwareHttpClient();
