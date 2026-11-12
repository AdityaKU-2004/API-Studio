import {
  ApiRequest,
  ApiResponse,
  RequestExecutionOptions,
  RequestTiming,
} from '../../types';
import { buildExecutableRequest } from './requestBuilder';
import { parseFetchResponse } from './responseParser';
import { normalizeResponse } from './responseNormalizer';
import { handleNetworkError } from './networkErrorHandler';
import { executeTestScripts } from './responseInterceptor';

export class RequestExecutor {
  private activeControllers: Map<string, { controller: AbortController; timeoutId?: ReturnType<typeof setTimeout> }> =
    new Map();

  /**
   * Cancels the active request for a specific tab.
   */
  public cancel(tabId: string): void {
    const entry = this.activeControllers.get(tabId);
    if (entry) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      const abortError = new Error('Request was cancelled by user');
      abortError.name = 'AbortError';
      entry.controller.abort(abortError);
      this.activeControllers.delete(tabId);
    }
  }

  /**
   * Checks if a request is actively running for the given tab.
   */
  public isExecuting(tabId: string): boolean {
    return this.activeControllers.has(tabId);
  }

  /**
   * Executes an HTTP request using the browser Fetch API.
   */
  public async execute(
    request: ApiRequest,
    options: RequestExecutionOptions = {}
  ): Promise<ApiResponse> {
    const tabId = options.tabId || 'default-tab';
    const executionId = 'exec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    // Cancel any previous in-flight request for this specific tab
    this.cancel(tabId);

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? request.settings?.timeout ?? 30000;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
        timeoutError.name = 'TimeoutError';
        controller.abort(timeoutError);
      }, timeoutMs);
    }

    this.activeControllers.set(tabId, { controller, timeoutId });

    const startTime = performance.now();
    const startTimestamp = Date.now();

    try {
      // 1. Build executable request & validation
      const buildResult = buildExecutableRequest(request, {
        ...options,
        signal: controller.signal,
      });

      const prepareEndTime = performance.now();
      const prepareMs = Math.round(prepareEndTime - startTime);

      if (buildResult.validationError) {
        throw new Error(buildResult.validationError);
      }

      // 2. Execute fetch
      const fetchResponse = await fetch(buildResult.fetchUrl, buildResult.fetchOptions);

      const headersReceivedTime = performance.now();
      const waitingMs = Math.round(headersReceivedTime - prepareEndTime);

      // 3. Read body stream
      const parsedBody = await parseFetchResponse(fetchResponse);

      const bodyEndTime = performance.now();
      const downloadMs = Math.round(bodyEndTime - headersReceivedTime);
      const totalDuration = Math.round(bodyEndTime - startTime);

      // Clean up controller & timeout
      if (timeoutId) clearTimeout(timeoutId);
      this.activeControllers.delete(tabId);

      const timing: RequestTiming = {
        startTime: startTimestamp,
        headersReceivedTime: Math.round(headersReceivedTime),
        endTime: Math.round(bodyEndTime),
        duration: totalDuration,
        prepareMs,
        waitingMs,
        downloadMs,
      };

      // 4. Normalize response
      const apiResponse = normalizeResponse(
        executionId,
        request.id,
        request.method,
        buildResult.fetchUrl,
        fetchResponse,
        parsedBody,
        timing
      );

      // 5. Execute post-response test scripts if configured
      const testScript =
        request.scripts?.postResponse?.enabled !== false
          ? request.scripts?.postResponse?.script || request.testScript
          : '';

      if (testScript) {
        const { testResults } = executeTestScripts(
          testScript,
          apiResponse,
          options.resolvedVariables || {}
        );
        apiResponse.tests = testResults;
      }

      return apiResponse;
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      this.activeControllers.delete(tabId);

      const errorEndTime = performance.now();
      const totalDuration = Math.round(errorEndTime - startTime);

      const networkError = handleNetworkError(err, request.url, timeoutMs);

      const timing: RequestTiming = {
        startTime: startTimestamp,
        endTime: Math.round(errorEndTime),
        duration: totalDuration,
        prepareMs: 0,
        waitingMs: 0,
        downloadMs: 0,
      };

      // Construct normalized error response
      return {
        id: executionId,
        requestId: request.id,
        status: 0,
        statusText: networkError.type.toUpperCase(),
        ok: false,
        url: request.url,
        method: request.method,
        headers: {},
        body: JSON.stringify(
          {
            error: networkError.type,
            message: networkError.message,
            details: networkError.details,
            troubleshooting: networkError.troubleshooting,
          },
          null,
          2
        ),
        rawBody: networkError.message,
        contentType: 'application/json',
        contentTypeCategory: 'json',
        size: 0,
        sizeBytes: 0,
        timeMs: totalDuration,
        timing,
        receivedAt: new Date().toISOString(),
        timestamp: Date.now(),
        cookies: [],
        tests: [],
        error: networkError,
      };
    }
  }
}

export const requestExecutor = new RequestExecutor();
