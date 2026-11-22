import React, { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import {
  AlertCircle,
  Clock,
  HardDrive,
  Copy,
  Check,
  Hexagon,
} from 'lucide-react';
import { GraphQLExecutionResponse } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { formatBytes } from '../../utils/formatBytes';
import { formatDuration } from '../../utils/formatDuration';
import { JsonTreeViewer } from '../../components/response-analysis/JsonTreeViewer';
import { JsonPathExplorer } from '../../components/response-analysis/JsonPathExplorer';

interface GraphQLResponseViewerProps {
  response: GraphQLExecutionResponse | null;
  isLoading: boolean;
}

export const GraphQLResponseViewer: React.FC<GraphQLResponseViewerProps> = ({
  response,
  isLoading,
}) => {
  const { theme, editorSettings } = useUiStore();
  const [activeTab, setActiveTab] = useState<'data' | 'tree' | 'jsonpath' | 'errors' | 'extensions' | 'headers'>('data');
  const [copied, setCopied] = useState(false);

  const formattedDataText = useMemo(() => {
    if (!response) return '';
    if (response.data !== null && response.data !== undefined) {
      return JSON.stringify(response.data, null, 2);
    }
    return response.rawBody || '';
  }, [response]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400 space-y-2">
        <div className="w-6 h-6 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-fuchsia-300">Executing GraphQL operation...</span>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500 space-y-2 select-none">
        <Hexagon className="w-10 h-10 text-fuchsia-400/30 stroke-1" />
        <div className="text-sm font-medium text-slate-300">GraphQL Response</div>
        <p className="text-xs max-w-sm">
          Enter an endpoint URL and operation document above, then click Execute to inspect GraphQL
          data, errors, extensions, and response headers.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(response.rawBody || formattedDataText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasErrors = response.errors.length > 0;
  const headerEntries = Object.entries(response.headers || {});

  return (
    <div className="flex flex-col h-full bg-[#10141d]/90 dark:bg-[#10141d]/90 light:bg-slate-50/90 overflow-hidden">
      {/* Top Status Strip */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-[#121620]/90 shrink-0 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span
            className={`px-2 py-0.5 rounded font-semibold border ${
              response.isNetworkError || response.httpStatus === 0
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : response.httpStatus >= 200 && response.httpStatus < 300
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            HTTP {response.httpStatus || 'ERR'} {response.httpStatusText}
          </span>

          {hasErrors && (
            <span className="px-2 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {response.errors.length} GraphQL Error{response.errors.length > 1 ? 's' : ''}
            </span>
          )}

          <span className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            {formatDuration(response.durationMs)}
          </span>

          <span className="flex items-center gap-1 text-slate-400">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            {formatBytes(response.sizeBytes)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer text-[11px]"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy Raw'}</span>
        </button>
      </div>

      {/* Response Sub-tabs */}
      <div className="flex items-center gap-1 px-3 border-b border-slate-800/80 bg-slate-900/50 text-xs shrink-0">
        {(
          [
            { id: 'data', label: 'Data' },
            { id: 'tree', label: 'Tree' },
            { id: 'jsonpath', label: 'JSONPath' },
            { id: 'errors', label: `Errors (${response.errors.length})` },
            { id: 'extensions', label: 'Extensions' },
            { id: 'headers', label: `Headers (${headerEntries.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`relative py-2 px-3 font-medium transition-colors cursor-pointer ${
              activeTab === t.id
                ? 'text-fuchsia-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-fuchsia-400" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'data' && (
          <Editor
            height="100%"
            language="json"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={formattedDataText}
            options={{
              readOnly: true,
              fontSize: editorSettings.fontSize,
              minimap: { enabled: false },
              wordWrap: editorSettings.wordWrap,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        )}

        {activeTab === 'tree' && (
          <JsonTreeViewer data={response.data} rawText={formattedDataText} />
        )}

        {activeTab === 'jsonpath' && (
          <JsonPathExplorer rawJsonText={response.rawBody || formattedDataText} />
        )}

        {activeTab === 'errors' && (
          <div className="h-full overflow-y-auto p-4 space-y-3">
            {response.errors.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">
                No GraphQL errors returned.
              </div>
            ) : (
              response.errors.map((err, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-red-950/25 border border-red-500/30 space-y-2 text-xs select-text"
                >
                  <div className="font-semibold text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{err.message}</span>
                  </div>
                  {(err.locations || err.path) && (
                    <div className="flex flex-wrap gap-3 text-[11px] font-mono text-slate-400 pl-6">
                      {err.path && <span>Path: {err.path.join('.')}</span>}
                      {err.locations && (
                        <span>
                          Locations:{' '}
                          {err.locations.map((l) => `L${l.line}:C${l.column}`).join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                  {err.extensions && (
                    <pre className="ml-6 p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {JSON.stringify(err.extensions, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'extensions' && (
          <div className="h-full overflow-y-auto p-4">
            {response.extensions ? (
              <pre className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-200 overflow-auto">
                {JSON.stringify(response.extensions, null, 2)}
              </pre>
            ) : (
              <div className="text-xs text-slate-500 text-center py-8">
                Server did not return a GraphQL extensions payload.
              </div>
            )}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="h-full overflow-y-auto p-3">
            {headerEntries.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">
                No response headers exposed.
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/60 font-mono text-xs">
                {headerEntries.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-12 px-3 py-2 gap-2">
                    <span className="col-span-4 text-slate-400 truncate">{k}</span>
                    <span className="col-span-8 text-cyan-300 break-all">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
