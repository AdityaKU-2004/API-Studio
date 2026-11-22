import React, { useState, useMemo } from 'react';
import { RefreshCw, Search, AlertTriangle, BookOpen } from 'lucide-react';
import { GraphQLIntrospectionSchema, GraphQLSchemaType } from '../../types';
import { formatGraphQLTypeRef } from '../../services/protocols/graphql/graphqlIntrospection';

interface GraphQLSchemaExplorerProps {
  schema?: GraphQLIntrospectionSchema;
  isLoading: boolean;
  errorMessage: string | null;
  onIntrospect: () => void;
}

export const GraphQLSchemaExplorer: React.FC<GraphQLSchemaExplorerProps> = ({
  schema,
  isLoading,
  errorMessage,
  onIntrospect,
}) => {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('ALL');
  const [selectedTypeName, setSelectedTypeName] = useState<string | null>(null);

  const filteredTypes = useMemo(() => {
    if (!schema) return [];
    const q = search.trim().toLowerCase();
    return schema.types.filter((t) => {
      if (kindFilter === 'ROOT') {
        const isRoot =
          t.name === schema.queryTypeName ||
          t.name === schema.mutationTypeName ||
          t.name === schema.subscriptionTypeName;
        if (!isRoot) return false;
      } else if (kindFilter !== 'ALL' && t.kind !== kindFilter) {
        return false;
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.fields?.some((f) => f.name.toLowerCase().includes(q)) ||
        t.inputFields?.some((f) => f.name.toLowerCase().includes(q))
      );
    });
  }, [schema, search, kindFilter]);

  const activeType: GraphQLSchemaType | undefined = useMemo(() => {
    if (!schema || filteredTypes.length === 0) return undefined;
    return (
      filteredTypes.find((t) => t.name === selectedTypeName) ||
      filteredTypes.find((t) => t.name === schema.queryTypeName) ||
      filteredTypes[0]
    );
  }, [schema, filteredTypes, selectedTypeName]);

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/80 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-fuchsia-400 shrink-0" />
          <span className="font-semibold text-slate-200 truncate">
            GraphQL Schema Explorer
          </span>
          {schema && (
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              ({schema.types.length} types)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onIntrospect}
          disabled={isLoading}
          className="px-3 py-1 rounded-lg bg-fuchsia-600/20 hover:bg-fuchsia-600/30 border border-fuchsia-500/40 text-fuchsia-300 font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Introspecting...' : schema ? 'Refresh Schema' : 'Introspect Schema'}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="m-3 p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Introspection Unavailable</div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {!schema ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
          <BookOpen className="w-10 h-10 text-slate-600 stroke-1" />
          <div className="text-sm font-medium text-slate-300">No Schema Loaded</div>
          <p className="text-xs max-w-md text-slate-500 leading-relaxed">
            Click &ldquo;Introspect Schema&rdquo; to query the target GraphQL server&apos;s
            <code className="mx-1 text-fuchsia-300">__schema</code> metadata. Endpoints with
            introspection disabled in production will safely display an explanatory notice.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left types list */}
          <div className="w-64 border-r border-slate-800 flex flex-col bg-slate-950/40 shrink-0">
            <div className="p-2 border-b border-slate-800 space-y-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search types or fields..."
                  className="w-full pl-7 pr-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-fuchsia-400"
                />
              </div>
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Types</option>
                <option value="ROOT">Root (Query / Mutation / Sub)</option>
                <option value="OBJECT">Objects</option>
                <option value="INPUT_OBJECT">Input Objects</option>
                <option value="ENUM">Enums</option>
                <option value="SCALAR">Scalars</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {filteredTypes.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSelectedTypeName(t.name)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left cursor-pointer ${
                    activeType?.name === t.name
                      ? 'bg-fuchsia-500/20 text-fuchsia-300 font-medium'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="font-mono truncate">{t.name}</span>
                  <span className="text-[9px] text-slate-500 font-mono shrink-0">{t.kind}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right type details */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeType ? (
              <>
                <div className="border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-fuchsia-300">
                      {activeType.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {activeType.kind}
                    </span>
                  </div>
                  {activeType.description && (
                    <p className="text-xs text-slate-400 mt-1">{activeType.description}</p>
                  )}
                </div>

                {activeType.fields && activeType.fields.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Fields ({activeType.fields.length})
                    </div>
                    <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-lg bg-slate-950/40">
                      {activeType.fields.map((f) => (
                        <div key={f.name} className="p-2.5 space-y-1 font-mono text-[11px]">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-slate-200 font-semibold">
                              {f.name}
                              {f.args && f.args.length > 0 && (
                                <span className="text-slate-400 font-normal">
                                  ({f.args.map((a) => `${a.name}: ${formatGraphQLTypeRef(a.type)}`).join(', ')})
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const baseName = f.type.name || formatGraphQLTypeRef(f.type).replace(/[[\]!]/g, '');
                                setSelectedTypeName(baseName);
                              }}
                              className="text-cyan-300 hover:underline shrink-0 cursor-pointer"
                            >
                              {formatGraphQLTypeRef(f.type)}
                            </button>
                          </div>
                          {f.description && (
                            <p className="font-sans text-[11px] text-slate-500">{f.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeType.inputFields && activeType.inputFields.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Input Fields ({activeType.inputFields.length})
                    </div>
                    <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-lg bg-slate-950/40">
                      {activeType.inputFields.map((f) => (
                        <div key={f.name} className="p-2 flex justify-between font-mono text-[11px]">
                          <span className="text-slate-200">{f.name}</span>
                          <span className="text-cyan-300">{formatGraphQLTypeRef(f.type)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeType.enumValues && activeType.enumValues.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Enum Values
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeType.enumValues.map((e) => (
                        <span
                          key={e.name}
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300"
                        >
                          {e.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-slate-500">Select a type to inspect its fields.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
