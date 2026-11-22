import React, { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  History,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { GraphQLQueryHistoryEntry } from '../../types';
import {
  formatGraphQLQuery,
  validateGraphQLQuerySyntax,
} from '../../services/protocols/graphql/graphqlFormatter';
import { useUiStore } from '../../stores/uiStore';

interface GraphQLQueryEditorProps {
  query: string;
  onChange: (nextQuery: string) => void;
  queryHistory: GraphQLQueryHistoryEntry[];
  onRestoreHistoryEntry: (entry: GraphQLQueryHistoryEntry) => void;
}

export const GraphQLQueryEditor: React.FC<GraphQLQueryEditorProps> = ({
  query,
  onChange,
  queryHistory,
  onRestoreHistoryEntry,
}) => {
  const { theme, editorSettings } = useUiStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const issues = useMemo(() => validateGraphQLQuerySyntax(query), [query]);

  const handleFormat = () => {
    const formatted = formatGraphQLQuery(query);
    if (formatted) onChange(formatted);
  };

  const editorBlock = (
    <div
      className={`flex flex-col h-full overflow-hidden bg-[#0f131b] dark:bg-[#0f131b] light:bg-white ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-xl border border-blue-500/40 shadow-2xl' : ''
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/60 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Query Document</span>
          {issues.length === 0 ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Syntax OK
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <AlertCircle className="w-3 h-3" />
              {issues[0].message}
              {issues[0].line ? ` (line ${issues[0].line})` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleFormat}
            title="Format GraphQL Query"
            className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 flex items-center gap-1 cursor-pointer text-[11px]"
          >
            <Sparkles className="w-3 h-3 text-fuchsia-400" />
            <span>Format</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            title="Recent GraphQL Query History"
            className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer text-[11px] ${
              showHistory
                ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <History className="w-3 h-3" />
            <span>History ({queryHistory.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Query Editor'}
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main editor + optional history drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 h-full">
          <Editor
            height="100%"
            language="graphql"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={query}
            onChange={(val) => onChange(val ?? '')}
            options={{
              fontSize: editorSettings.fontSize,
              tabSize: editorSettings.tabSize,
              wordWrap: editorSettings.wordWrap,
              lineNumbers: editorSettings.lineNumbers,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>

        {showHistory && (
          <div className="w-64 border-l border-slate-800 bg-slate-950/90 overflow-y-auto p-2 space-y-2 shrink-0">
            <div className="text-[11px] font-semibold text-slate-300 px-1">
              Recent Query Executions
            </div>
            {queryHistory.length === 0 ? (
              <div className="text-[11px] text-slate-500 px-1 py-4">
                No recent queries executed in this tab yet.
              </div>
            ) : (
              queryHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onRestoreHistoryEntry(item)}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-fuchsia-500/40 cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="truncate text-fuchsia-300">
                      {item.operationName || 'Anonymous'}
                    </span>
                    <span className="flex items-center gap-1">
                      <RotateCcw className="w-2.5 h-2.5" />
                      {new Date(item.executedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-300 line-clamp-3 whitespace-pre-wrap">
                    {item.query}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
          onClick={() => setIsFullscreen(false)}
        />
        {editorBlock}
      </>
    );
  }

  return editorBlock;
};
