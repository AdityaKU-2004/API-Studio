import { ApiRequest, ApiResponse, RequestExecutionOptions } from '../../types';
import { requestExecutor } from './requestExecutor';

/**
 * Standardized HTTP execution contract.
 * In Phase 3, this uses the browser Fetch API.
 * In Phase 7, this can be seamlessly swapped for a Tauri / Rust native HTTP client.
 */
export interface HttpExecutionService {
  execute(request: ApiRequest, options?: RequestExecutionOptions): Promise<ApiResponse>;
  cancel(tabId: string): void;
  isExecuting(tabId: string): boolean;
}

class BrowserFetchHttpClient implements HttpExecutionService {
  public execute(request: ApiRequest, options?: RequestExecutionOptions): Promise<ApiResponse> {
    return requestExecutor.execute(request, options);
  }

  public cancel(tabId: string): void {
    requestExecutor.cancel(tabId);
  }

  public isExecuting(tabId: string): boolean {
    return requestExecutor.isExecuting(tabId);
  }
}

export const httpClient: HttpExecutionService = new BrowserFetchHttpClient();
