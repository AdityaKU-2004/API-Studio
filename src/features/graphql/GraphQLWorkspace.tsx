import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Play, Square, Save, Eye } from 'lucide-react';
import { GraphQLHttpMethod, GraphQLRequestConfig } from '../../types';
import { useRequestStore } from '../../stores/requestStore';
import { useGraphQLStore } from '../../stores/graphqlStore';
import { useUiStore } from '../../stores/uiStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { createDefaultGraphQLConfig } from '../../services/request/protocolRequestFactory';
import { extractOperationNames } from '../../services/protocols/graphql/graphqlFormatter';
import { RequestTypeSelector } from '../../components/request-types/RequestTypeSelector';
import { HeadersEditor } from '../../components/request/headers/HeadersEditor';
import { AuthorizationEditor } from '../../components/request/auth/AuthorizationEditor';
import { RequestSettings } from '../../components/request/settings/RequestSettings';
import { SaveRequestAsModal } from '../../components/request/SaveRequestAsModal';
import { RequestPreviewModal } from '../../components/request/preview/RequestPreviewModal';
import { GraphQLQueryEditor } from './GraphQLQueryEditor';
import { GraphQLVariablesEditor } from './GraphQLVariablesEditor';
import { GraphQLSchemaExplorer } from './GraphQLSchemaExplorer';
import { GraphQLResponseViewer } from './GraphQLResponseViewer';

export const GraphQLWorkspace: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest, switchActiveRequestType, saveActiveRequest } =
    useRequestStore();
  const { splitRatio, setSplitRatio } = useUiStore();
  const {
    responsesByTabId,
    loadingByTabId,
    schemasByEndpoint,
    schemaLoadingByTabId,
    schemaErrorByTabId,
    executeGraphQL,
    cancelGraphQL,
    introspectSchema,
  } = useGraphQLStore();

  const [subTab, setSubTab] = useState<'query' | 'headers' | 'auth' | 'schema' | 'settings'>('query');
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const graphql: GraphQLRequestConfig = useMemo(
    () => request?.graphql || createDefaultGraphQLConfig(request?.url),
    [request]
  );

  const detectedOps = useMemo(() => extractOperationNames(graphql.query), [graphql.query]);

  // Resolve endpoint for schema cache lookup
  const resolvedEndpoint = useMemo(() => {
    if (!request) return graphql.endpoint;
    const col = request.collectionId
      ? useCollectionStore.getState().collections.find((c) => c.id === request.collectionId)
      : undefined;
    const vars = useEnvironmentStore.getState().getResolvedVariables({
      collectionVariables: col?.variables,
      requestVariables: request.variables,
    });
    let ep = graphql.endpoint;
    for (const [k, v] of Object.entries(vars)) {
      ep = ep.replaceAll(`{{${k}}}`, v);
    }
    return ep;
  }, [graphql.endpoint, request]);

  const startDragging = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const onMove = (ev: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setSplitRatio(((ev.clientY - rect.top) / rect.height) * 100);
      };
      const onUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [setSplitRatio]
  );

  if (!request) return null;

  const isLoading = !!loadingByTabId[activeTabId];
  const gqlResponse = responsesByTabId[activeTabId] || null;

  const updateGraphQL = (updates: Partial<GraphQLRequestConfig>) => {
    const nextGql: GraphQLRequestConfig = { ...graphql, ...updates };
    updateActiveRequest({
      graphql: nextGql,
      ...(updates.endpoint !== undefined ? { url: updates.endpoint } : {}),
      ...(updates.method !== undefined ? { method: updates.method } : {}),
    });
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top GraphQL Workspace Section */}
      <div
        style={{ height: `${splitRatio}%` }}
        className="flex flex-col bg-[#11151e]/80 dark:bg-[#11151e]/80 light:bg-white/80 overflow-hidden"
      >
        {/* Top Protocol + Action Toolbar */}
        <div className="px-3 pt-2.5 pb-2.5 border-b border-blue-500/15 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <RequestTypeSelector
              value="graphql"
              onChange={switchActiveRequestType}
              compact
            />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => (request.collectionId ? saveActiveRequest() : setIsSaveAsOpen(true))}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-blue-400" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Endpoint + Method + OperationName + Execute */}
          <div className="flex items-center gap-2">
            <select
              value={graphql.method}
              onChange={(e) => updateGraphQL({ method: e.target.value as GraphQLHttpMethod })}
              className="px-2.5 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-mono font-semibold text-fuchsia-300 focus:outline-none focus:border-fuchsia-400"
              title="GraphQL HTTP Transport Method"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>

            <input
              type="text"
              value={graphql.endpoint}
              onChange={(e) => updateGraphQL({ endpoint: e.target.value })}
              placeholder="https://api.example.com/graphql or {{base_url}}/graphql"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-400"
            />

            <input
              type="text"
              value={graphql.operationName || ''}
              onChange={(e) => updateGraphQL({ operationName: e.target.value })}
              list="graphql-op-names"
              placeholder="Operation (optional)"
              className="w-40 hidden md:block px-2.5 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-400"
            />
            <datalist id="graphql-op-names">
              {detectedOps.map((op) => (
                <option key={op} value={op} />
              ))}
            </datalist>

            {isLoading ? (
              <button
                type="button"
                onClick={() => cancelGraphQL(activeTabId)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Cancel</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void executeGraphQL(activeTabId, request)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 hover:brightness-110 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 px-3 border-b border-slate-800/80 bg-slate-900/40 text-xs shrink-0">
          {(
            [
              { id: 'query', label: 'Query & Variables' },
              { id: 'headers', label: `Headers (${request.headers.filter((h) => h.enabled && h.key).length})` },
              { id: 'auth', label: 'Authorization' },
              { id: 'schema', label: 'Schema Explorer' },
              { id: 'settings', label: 'Settings' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`relative py-2 px-3 font-medium cursor-pointer transition-colors ${
                subTab === t.id ? 'text-fuchsia-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
              {subTab === t.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-fuchsia-400" />
              )}
            </button>
          ))}
        </div>

        {/* Sub-tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {subTab === 'query' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 h-full divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
              <div className="lg:col-span-7 h-full min-h-[160px] overflow-hidden">
                <GraphQLQueryEditor
                  query={graphql.query}
                  onChange={(q) => updateGraphQL({ query: q })}
                  queryHistory={graphql.queryHistory || []}
                  onRestoreHistoryEntry={(entry) =>
                    updateGraphQL({
                      query: entry.query,
                      variablesText: entry.variablesText,
                      operationName: entry.operationName,
                    })
                  }
                />
              </div>
              <div className="lg:col-span-5 h-full min-h-[120px] overflow-hidden">
                <GraphQLVariablesEditor
                  variablesText={graphql.variablesText}
                  onChange={(v) => updateGraphQL({ variablesText: v })}
                />
              </div>
            </div>
          )}

          {subTab === 'headers' && (
            <div className="h-full overflow-y-auto">
              <HeadersEditor />
            </div>
          )}
          {subTab === 'auth' && (
            <div className="h-full overflow-y-auto">
              <AuthorizationEditor />
            </div>
          )}
          {subTab === 'schema' && (
            <GraphQLSchemaExplorer
              schema={schemasByEndpoint[resolvedEndpoint]}
              isLoading={!!schemaLoadingByTabId[activeTabId]}
              errorMessage={schemaErrorByTabId[activeTabId] || null}
              onIntrospect={() => void introspectSchema(activeTabId, request)}
            />
          )}
          {subTab === 'settings' && (
            <div className="h-full overflow-y-auto">
              <RequestSettings />
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Split Handle */}
      <div
        onMouseDown={startDragging}
        className={`h-1.5 w-full cursor-row-resize hover:bg-fuchsia-500/50 transition-colors z-20 flex items-center justify-center shrink-0 ${
          isDragging ? 'bg-fuchsia-400' : 'bg-slate-800/80'
        }`}
      >
        <div className="w-8 h-0.5 rounded-full bg-slate-500/80" />
      </div>

      {/* Bottom GraphQL Response Viewer */}
      <div style={{ height: `${100 - splitRatio}%` }} className="w-full overflow-hidden">
        <GraphQLResponseViewer response={gqlResponse} isLoading={isLoading} />
      </div>

      <SaveRequestAsModal isOpen={isSaveAsOpen} onClose={() => setIsSaveAsOpen(false)} />
      <RequestPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        request={request}
      />
    </div>
  );
};
