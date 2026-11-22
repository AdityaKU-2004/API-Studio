import {
  ApiRequest,
  ApiResponse,
  GraphQLErrorItem,
  GraphQLExecutionResponse,
  GraphQLRequestConfig,
} from '../../../types';
import { httpClient } from '../../http/httpClient';
import { substituteVariables } from '../http/diagnosticsAnalyzer';
import { validateGraphQLVariables } from './graphqlFormatter';

export interface GraphQLExecuteOptions {
  tabId: string;
  request: ApiRequest;
  graphql: GraphQLRequestConfig;
  resolvedVariables: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Builds the underlying HTTP ApiRequest for a GraphQL operation (POST JSON or GET query params).
 */
export function buildGraphQLHttpRequest(
  baseRequest: ApiRequest,
  graphql: GraphQLRequestConfig,
  resolvedVariables: Record<string, string>
): { httpRequest?: ApiRequest; validationError?: string } {
  const endpoint = substituteVariables(graphql.endpoint || baseRequest.url || '', resolvedVariables).trim();
  if (!endpoint) {
    return { validationError: 'GraphQL endpoint URL is empty.' };
  }

  const query = substituteVariables(graphql.query || '', resolvedVariables);
  if (!query.trim()) {
    return { validationError: 'GraphQL query document is empty.' };
  }

  const resolvedVarsText = substituteVariables(graphql.variablesText || '', resolvedVariables);
  const varsCheck = validateGraphQLVariables(resolvedVarsText);
  if (!varsCheck.valid) {
    return { validationError: varsCheck.error };
  }

  const operationName = graphql.operationName?.trim()
    ? substituteVariables(graphql.operationName.trim(), resolvedVariables)
    : undefined;

  if (graphql.method === 'GET') {
    const queryParams = [
      { id: 'gql-q', key: 'query', value: query, enabled: true },
      ...(Object.keys(varsCheck.parsed).length > 0
        ? [{ id: 'gql-v', key: 'variables', value: JSON.stringify(varsCheck.parsed), enabled: true }]
        : []),
      ...(operationName
        ? [{ id: 'gql-op', key: 'operationName', value: operationName, enabled: true }]
        : []),
    ];

    return {
      httpRequest: {
        ...baseRequest,
        method: 'GET',
        url: endpoint,
        params: [...(baseRequest.params || []), ...queryParams],
        bodyType: 'none',
        rawBody: '',
        body: {
          mode: 'none',
          rawContent: {},
          formData: [],
          urlEncoded: [],
          binary: {},
        },
      },
    };
  }

  const payloadObj: Record<string, unknown> = {
    query,
    variables: varsCheck.parsed,
  };
  if (operationName) {
    payloadObj.operationName = operationName;
  }

  const payloadJson = JSON.stringify(payloadObj);

  const hasContentType = (baseRequest.headers || []).some(
    (h) => h.enabled && h.key.toLowerCase() === 'content-type'
  );
  const headers = hasContentType
    ? baseRequest.headers
    : [
        ...(baseRequest.headers || []),
        { id: 'gql-ct', key: 'Content-Type', value: 'application/json', enabled: true },
      ];

  return {
    httpRequest: {
      ...baseRequest,
      method: 'POST',
      url: endpoint,
      headers,
      bodyType: 'json',
      rawBody: payloadJson,
      body: {
        mode: 'json',
        rawContent: { json: payloadJson },
        formData: [],
        urlEncoded: [],
        binary: {},
      },
    },
  };
}

/**
 * Parses an HTTP ApiResponse into a GraphQLExecutionResponse, preserving GraphQL errors
 * even when HTTP status is 200.
 */
export function parseGraphQLApiResponse(apiResponse: ApiResponse): GraphQLExecutionResponse {
  if (apiResponse.status === 0 && apiResponse.error) {
    return {
      id: apiResponse.id,
      httpStatus: 0,
      httpStatusText: apiResponse.statusText,
      headers: apiResponse.headers,
      durationMs: apiResponse.timeMs,
      sizeBytes: apiResponse.sizeBytes || 0,
      rawBody: apiResponse.rawBody || apiResponse.body,
      data: null,
      errors: [],
      isNetworkError: true,
      networkErrorMessage: apiResponse.error.message,
      receivedAt: apiResponse.receivedAt,
    };
  }

  let parsedJson: any = apiResponse.parsedBody;
  if (parsedJson === undefined && apiResponse.body) {
    try {
      parsedJson = JSON.parse(apiResponse.body);
    } catch {
      parsedJson = undefined;
    }
  }

  if (parsedJson && typeof parsedJson === 'object') {
    const errors: GraphQLErrorItem[] = Array.isArray(parsedJson.errors)
      ? parsedJson.errors.map((e: any) => ({
          message: typeof e?.message === 'string' ? e.message : JSON.stringify(e),
          locations: Array.isArray(e?.locations) ? e.locations : undefined,
          path: Array.isArray(e?.path) ? e.path : undefined,
          extensions: e?.extensions && typeof e.extensions === 'object' ? e.extensions : undefined,
        }))
      : [];

    return {
      id: apiResponse.id,
      httpStatus: apiResponse.status,
      httpStatusText: apiResponse.statusText,
      headers: apiResponse.headers,
      durationMs: apiResponse.timeMs,
      sizeBytes: apiResponse.sizeBytes || apiResponse.size || 0,
      rawBody: apiResponse.body,
      data: 'data' in parsedJson ? parsedJson.data : null,
      errors,
      extensions:
        parsedJson.extensions && typeof parsedJson.extensions === 'object'
          ? parsedJson.extensions
          : undefined,
      receivedAt: apiResponse.receivedAt,
    };
  }

  return {
    id: apiResponse.id,
    httpStatus: apiResponse.status,
    httpStatusText: apiResponse.statusText,
    headers: apiResponse.headers,
    durationMs: apiResponse.timeMs,
    sizeBytes: apiResponse.sizeBytes || apiResponse.size || 0,
    rawBody: apiResponse.body,
    data: null,
    errors: [
      {
        message: `Response was not valid GraphQL JSON (HTTP ${apiResponse.status} ${apiResponse.statusText}).`,
      },
    ],
    receivedAt: apiResponse.receivedAt,
  };
}

class GraphQLClientService {
  public async execute(options: GraphQLExecuteOptions): Promise<{
    gqlResponse: GraphQLExecutionResponse;
    apiResponse?: ApiResponse;
  }> {
    const built = buildGraphQLHttpRequest(options.request, options.graphql, options.resolvedVariables);
    if (built.validationError || !built.httpRequest) {
      return {
        gqlResponse: {
          id: 'gql-err-' + Date.now(),
          httpStatus: 0,
          httpStatusText: 'VALIDATION_ERROR',
          headers: {},
          durationMs: 0,
          sizeBytes: 0,
          rawBody: '',
          data: null,
          errors: [{ message: built.validationError || 'Invalid GraphQL request' }],
          isNetworkError: true,
          networkErrorMessage: built.validationError,
          receivedAt: new Date().toISOString(),
        },
      };
    }

    const apiResponse = await httpClient.execute(built.httpRequest, {
      tabId: options.tabId,
      resolvedVariables: options.resolvedVariables,
      timeoutMs: options.timeoutMs ?? options.request.settings?.timeout,
      skipScripts: true,
    });

    return {
      gqlResponse: parseGraphQLApiResponse(apiResponse),
      apiResponse,
    };
  }

  public cancel(tabId: string): void {
    httpClient.cancel(tabId);
  }
}

export const graphqlClient = new GraphQLClientService();
