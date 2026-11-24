import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  FileCode2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Plus,
  RefreshCw,
  GitBranch,
  Download,
} from 'lucide-react';
import { useSpecStore } from '../../stores/specStore';
import { parseRawSpecObject, serializeSpecObject } from '../../services/openapi/openapiParser';

export const SpecEditorView: React.FC = () => {
  const {
    specs,
    activeSpecId,
    validationIssues,
    selectSpec,
    updateSpecContent,
    convertSpecFormat,
    createVersionSnapshot,
  } = useSpecStore();

  const activeSpec = specs.find((s) => s.id === activeSpecId) || null;
  const [draftContent, setDraftContent] = useState(activeSpec?.content || '');
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [showQuickBuilder, setShowQuickBuilder] = useState(false);

  // Visual quick endpoint adder state
  const [newEndpointPath, setNewEndpointPath] = useState('/items');
  const [newEndpointMethod, setNewEndpointMethod] = useState<'get' | 'post' | 'put' | 'delete'>('get');
  const [newEndpointSummary, setNewEndpointSummary] = useState('List items');

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftContent(activeSpec?.content || '');
  }, [activeSpecId]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleContentChange = (nextVal: string | undefined) => {
    const val = nextVal ?? '';
    setDraftContent(val);
    if (!activeSpec) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void updateSpecContent(activeSpec.id, val, activeSpec.format);
    }, 300);
  };

  const handleJumpToIssue = (line: number, column: number) => {
    if (!editorRef.current) return;
    editorRef.current.revealLineInCenter(line);
    editorRef.current.setPosition({ lineNumber: line, column });
    editorRef.current.focus();
  };

  const handleAddVisualEndpoint = async () => {
    if (!activeSpec) return;
    try {
      const { doc, format } = parseRawSpecObject(draftContent);
      const paths = ((doc.paths as Record<string, Record<string, unknown>>) || {});
      const cleanPath = newEndpointPath.startsWith('/') ? newEndpointPath : `/${newEndpointPath}`;
      paths[cleanPath] = {
        ...(paths[cleanPath] || {}),
        [newEndpointMethod]: {
          summary: newEndpointSummary.trim() || `${newEndpointMethod.toUpperCase()} ${cleanPath}`,
          operationId: `${newEndpointMethod}_${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { ok: { type: 'boolean', example: true } } },
                },
              },
            },
          },
        },
      };
      doc.paths = paths;
      const serialized = serializeSpecObject(doc, format);
      setDraftContent(serialized);
      await updateSpecContent(activeSpec.id, serialized, format);
      setShowQuickBuilder(false);
      setStatusNotice(`Added ${newEndpointMethod.toUpperCase()} ${cleanPath} to specification.`);
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err) {
      setStatusNotice(`Cannot update YAML/JSON visually while syntax error exists: ${(err as Error).message}`);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!activeSpec) return;
    const label = snapshotLabel.trim() || `${activeSpec.version}-snap-${new Date().toISOString().slice(11, 19)}`;
    await createVersionSnapshot(activeSpec.id, label, 'Saved from Spec Editor');
    setSnapshotLabel('');
    setStatusNotice(`Saved immutable API version snapshot "${label}".`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleDownloadSpec = () => {
    if (!activeSpec) return;
    const blob = new Blob([draftContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSpec.name.toLowerCase().replace(/\s+/g, '-')}.${activeSpec.format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
  const warnCount = validationIssues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="h-full flex flex-col bg-[#0d111a] text-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-[#111622] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <FileCode2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-100">OpenAPI Specification Editor</span>
          <select
            value={activeSpecId || ''}
            onChange={(e) => selectSpec(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
          >
            {specs.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} ({sp.format.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQuickBuilder(!showQuickBuilder)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-cyan-300 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Endpoint</span>
          </button>

          {activeSpec && (
            <button
              type="button"
              onClick={async () => {
                const nextFmt = activeSpec.format === 'yaml' ? 'json' : 'yaml';
                await convertSpecFormat(activeSpec.id, nextFmt);
                const updated = useSpecStore.getState().specs.find((s) => s.id === activeSpec.id);
                if (updated) setDraftContent(updated.content);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Convert to {activeSpec.format === 'yaml' ? 'JSON' : 'YAML'}</span>
            </button>
          )}

          <div className="flex items-center gap-1">
            <input
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="v1.1.0"
              className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
            <button
              type="button"
              onClick={handleSaveSnapshot}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white flex items-center gap-1 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Save Version</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSpec}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Visual Endpoint Adder Bar */}
      {showQuickBuilder && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/70 flex flex-wrap items-center gap-2 text-xs">
          <select
            value={newEndpointMethod}
            onChange={(e) => setNewEndpointMethod(e.target.value as any)}
            className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-200 font-mono uppercase"
          >
            <option value="get">GET</option>
            <option value="post">POST</option>
            <option value="put">PUT</option>
            <option value="delete">DELETE</option>
          </select>
          <input
            type="text"
            value={newEndpointPath}
            onChange={(e) => setNewEndpointPath(e.target.value)}
            placeholder="/users/{id}"
            className="px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 font-mono"
          />
          <input
            type="text"
            value={newEndpointSummary}
            onChange={(e) => setNewEndpointSummary(e.target.value)}
            placeholder="Operation summary"
            className="flex-1 min-w-[180px] px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-200"
          />
          <button
            type="button"
            onClick={handleAddVisualEndpoint}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer"
          >
            Insert Operation
          </button>
        </div>
      )}

      {statusNotice && (
        <div className="px-4 py-2 bg-cyan-950/40 border-b border-cyan-500/30 text-xs text-cyan-300">
          {statusNotice}
        </div>
      )}

      {/* Split Monaco Editor & Validation Diagnostics */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={activeSpec?.format === 'json' ? 'json' : 'yaml'}
            theme="vs-dark"
            value={draftContent}
            onChange={handleContentChange}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              tabSize: 2,
              wordWrap: 'on',
              folding: true,
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>

        {/* Validation Panel */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#10141f] flex flex-col max-h-64 lg:max-h-none">
          <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">Live Validator</span>
            <div className="flex items-center gap-2">
              {errorCount === 0 ? (
                <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Valid
                </span>
              ) : (
                <span className="text-red-400 font-mono text-[11px]">{errorCount} errors</span>
              )}
              {warnCount > 0 && (
                <span className="text-amber-400 font-mono text-[11px]">{warnCount} warn</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {validationIssues.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No syntax or structural OpenAPI issues found.
              </div>
            ) : (
              validationIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => handleJumpToIssue(issue.line, issue.column)}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 space-y-1 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`flex items-center gap-1 font-semibold uppercase ${
                        issue.severity === 'error'
                          ? 'text-red-400'
                          : issue.severity === 'warning'
                            ? 'text-amber-400'
                            : 'text-cyan-400'
                      }`}
                    >
                      {issue.severity === 'error' ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : issue.severity === 'warning' ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <Info className="w-3 h-3" />
                      )}
                      {issue.severity}
                    </span>
                    <span className="font-mono text-slate-500">
                      Ln {issue.line}, Col {issue.column}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">{issue.message}</p>
                  <div className="text-[10px] font-mono text-slate-500 truncate">{issue.path}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
