import { create } from 'zustand';
import {
  ApiRequest,
  GraphQLExecutionResponse,
  GraphQLIntrospectionSchema,
  GraphQLQueryHistoryEntry,
} from '../types';
import { graphqlClient } from '../services/protocols/graphql/graphqlClient';
import { fetchGraphQLIntrospectionSchema } from '../services/protocols/graphql/graphqlIntrospection';
import { createDefaultGraphQLConfig } from '../services/request/protocolRequestFactory';
import { storageService } from '../services/storage/storageService';
import { useEnvironmentStore } from './environmentStore';
import { useCollectionStore } from './collectionStore';
import { useExecutionStore } from './executionStore';
import { useHistoryStore } from './historyStore';
import { useRequestStore } from './requestStore';

function getResolvedVarsForRequest(request: ApiRequest): Record<string, string> {
  const col = request.collectionId
    ? useCollectionStore.getState().collections.find((c) => c.id === request.collectionId)
    : undefined;
  return useEnvironmentStore.getState().getResolvedVariables({
    collectionVariables: col?.variables,
    requestVariables: request.variables,
  });
}

interface GraphQLState {
  responsesByTabId: Record<string, GraphQLExecutionResponse | null>;
  loadingByTabId: Record<string, boolean>;
  schemasByEndpoint: Record<string, GraphQLIntrospectionSchema>;
  schemaLoadingByTabId: Record<string, boolean>;
  schemaErrorByTabId: Record<string, string | null>;

  executeGraphQL: (tabId: string, request: ApiRequest) => Promise<void>;
  cancelGraphQL: (tabId: string) => void;
  introspectSchema: (tabId: string, request: ApiRequest) => Promise<void>;
  clearSchemaError: (tabId: string) => void;
}

export const useGraphQLStore = create<GraphQLState>((set) => ({
  responsesByTabId: {},
  loadingByTabId: {},
  schemasByEndpoint: {},
  schemaLoadingByTabId: {},
  schemaErrorByTabId: {},

  executeGraphQL: async (tabId, request) => {
    const graphql = request.graphql || createDefaultGraphQLConfig(request.url);
    const execStore = useExecutionStore.getState();

    set((s) => ({
      loadingByTabId: { ...s.loadingByTabId, [tabId]: true },
    }));

    execStore.addLog({
      level: 'info',
      category: 'graphql',
      tabId,
      requestId: request.id,
      method: graphql.method,
      url: graphql.endpoint,
      title: 'GraphQL Operation Started',
      message: `${graphql.method} ${graphql.endpoint}${graphql.operationName ? ` (${graphql.operationName})` : ''}`,
    });

    try {
      let effectiveRequest = { ...request };
      if (effectiveRequest.collectionId) {
        try {
          const inherited = await storageService.resolveEffectiveConfiguration(effectiveRequest);
          effectiveRequest = {
            ...effectiveRequest,
            auth: inherited.effectiveAuth,
            headers: inherited.effectiveHeaders,
          };
        } catch {
          // ignore inheritance fallback errors
        }
      }

      const resolvedVars = getResolvedVarsForRequest(effectiveRequest);
      const { gqlResponse, apiResponse } = await graphqlClient.execute({
        tabId,
        request: effectiveRequest,
        graphql,
        resolvedVariables: resolvedVars,
        timeoutMs: effectiveRequest.settings?.timeout,
      });

      set((s) => ({
        responsesByTabId: { ...s.responsesByTabId, [tabId]: gqlResponse },
        loadingByTabId: { ...s.loadingByTabId, [tabId]: false },
      }));

      // Log execution result
      if (gqlResponse.isNetworkError) {
        execStore.addLog({
          level: 'error',
          category: 'graphql',
          tabId,
          requestId: request.id,
          method: graphql.method,
          url: graphql.endpoint,
          title: 'GraphQL Request Failed',
          message: gqlResponse.networkErrorMessage || 'Network error occurred',
          durationMs: gqlResponse.durationMs,
        });
      } else if (gqlResponse.errors.length > 0) {
        execStore.addLog({
          level: 'warn',
          category: 'graphql',
          tabId,
          requestId: request.id,
          method: graphql.method,
          url: graphql.endpoint,
          title: 'GraphQL Returned Errors',
          message: `HTTP ${gqlResponse.httpStatus} with ${gqlResponse.errors.length} GraphQL error(s) (${gqlResponse.durationMs}ms)`,
          durationMs: gqlResponse.durationMs,
        });
      } else {
        execStore.addLog({
          level: 'success',
          category: 'graphql',
          tabId,
          requestId: request.id,
          method: graphql.method,
          url: graphql.endpoint,
          title: 'GraphQL Operation Completed',
          message: `HTTP ${gqlResponse.httpStatus} (${gqlResponse.durationMs}ms, ${gqlResponse.sizeBytes} bytes)`,
          durationMs: gqlResponse.durationMs,
        });
      }

      // Append to query history on the active tab request
      const historyEntry: GraphQLQueryHistoryEntry = {
        id: 'gqlh-' + Date.now(),
        query: graphql.query,
        variablesText: graphql.variablesText,
        endpoint: graphql.endpoint,
        operationName: graphql.operationName,
        executedAt: Date.now(),
        durationMs: gqlResponse.durationMs,
        hadErrors: gqlResponse.errors.length > 0 || !!gqlResponse.isNetworkError,
      };
      const reqStore = useRequestStore.getState();
      if (reqStore.activeTabId === tabId) {
        const nextHistory = [historyEntry, ...(graphql.queryHistory || [])].slice(0, 25);
        reqStore.updateActiveRequest({
          graphql: {
            ...graphql,
            queryHistory: nextHistory,
          },
        });
      }

      // Record in global history unless aborted
      if (apiResponse?.error?.type !== 'abort') {
        void useHistoryStore.getState().addHistoryItem({
          requestId: request.id,
          requestName: request.name,
          requestType: 'graphql',
          method: graphql.method,
          url: graphql.endpoint,
          resolvedUrl: apiResponse?.url || graphql.endpoint,
          status: gqlResponse.httpStatus,
          statusText: gqlResponse.httpStatusText,
          timeMs: gqlResponse.durationMs,
          sizeBytes: gqlResponse.sizeBytes,
          timestamp: Date.now(),
          executionResult: gqlResponse.isNetworkError ? 'error' : 'success',
          errorSummary:
            gqlResponse.networkErrorMessage ||
            (gqlResponse.errors.length > 0 ? gqlResponse.errors[0].message : undefined),
          request: JSON.parse(JSON.stringify(request)),
          responseHeaders: gqlResponse.headers,
          responseBody: gqlResponse.rawBody,
          responseBodySnippet: gqlResponse.rawBody?.slice(0, 500),
          protocolMetadata: {
            graphqlErrorsCount: gqlResponse.errors.length,
            operationName: graphql.operationName,
          },
        });
      }
    } catch (err) {
      set((s) => ({
        loadingByTabId: { ...s.loadingByTabId, [tabId]: false },
      }));
      execStore.addLog({
        level: 'error',
        category: 'graphql',
        tabId,
        requestId: request.id,
        title: 'GraphQL Execution Exception',
        message: err instanceof Error ? err.message : 'Unexpected GraphQL failure',
      });
    }
  },

  cancelGraphQL: (tabId) => {
    graphqlClient.cancel(tabId);
    set((s) => ({
      loadingByTabId: { ...s.loadingByTabId, [tabId]: false },
    }));
  },

  introspectSchema: async (tabId, request) => {
    const graphql = request.graphql || createDefaultGraphQLConfig(request.url);
    const resolvedVars = getResolvedVarsForRequest(request);
    let resolvedEndpoint = graphql.endpoint;
    for (const [k, v] of Object.entries(resolvedVars)) {
      resolvedEndpoint = resolvedEndpoint.replaceAll(`{{${k}}}`, v);
    }

    set((s) => ({
      schemaLoadingByTabId: { ...s.schemaLoadingByTabId, [tabId]: true },
      schemaErrorByTabId: { ...s.schemaErrorByTabId, [tabId]: null },
    }));

    try {
      let effectiveRequest = { ...request };
      if (effectiveRequest.collectionId) {
        try {
          const inherited = await storageService.resolveEffectiveConfiguration(effectiveRequest);
          effectiveRequest = {
            ...effectiveRequest,
            auth: inherited.effectiveAuth,
            headers: inherited.effectiveHeaders,
          };
        } catch {
          // ignore
        }
      }

      const result = await fetchGraphQLIntrospectionSchema(
        effectiveRequest,
        graphql.endpoint,
        resolvedVars,
        tabId
      );

      if (result.schema) {
        set((s) => ({
          schemasByEndpoint: { ...s.schemasByEndpoint, [resolvedEndpoint]: result.schema! },
          schemaLoadingByTabId: { ...s.schemaLoadingByTabId, [tabId]: false },
          schemaErrorByTabId: { ...s.schemaErrorByTabId, [tabId]: null },
        }));
      } else {
        set((s) => ({
          schemaLoadingByTabId: { ...s.schemaLoadingByTabId, [tabId]: false },
          schemaErrorByTabId: {
            ...s.schemaErrorByTabId,
            [tabId]: result.disabledOrError || 'Schema introspection failed.',
          },
        }));
      }
    } catch (err) {
      set((s) => ({
        schemaLoadingByTabId: { ...s.schemaLoadingByTabId, [tabId]: false },
        schemaErrorByTabId: {
          ...s.schemaErrorByTabId,
          [tabId]: err instanceof Error ? err.message : 'Schema introspection failed.',
        },
      }));
    }
  },

  clearSchemaError: (tabId) => {
    set((s) => ({
      schemaErrorByTabId: { ...s.schemaErrorByTabId, [tabId]: null },
    }));
  },
}));
