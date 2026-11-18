import React, { useState, useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useRequestStore } from '../../../stores/requestStore';
import { useUiStore } from '../../../stores/uiStore';
import { useScriptingStore } from '../../../stores/scriptingStore';
import { useAppStore } from '../../../stores/appStore';
import { Trash2, Play, Square, ChevronDown, BookOpen, Terminal } from 'lucide-react';
import { ScriptFailurePolicy } from '../../../types';
import { ScriptConsole } from '../../scripting/ScriptConsole';
import { ScriptExecutionStatus } from '../../scripting/ScriptExecutionStatus';
import { validateScriptSyntax } from '../../../services/scripting/scriptValidator';

export const ScriptsEditor: React.FC = () => {
  const { tabs, activeTabId, activeResponse, updateActiveRequest } = useRequestStore();
  const { theme, editorSettings } = useUiStore();
  const {
    templates,
    isExecutingByTab,
    lastResultByTabStage,
    consoleLogsByTab,
    runScriptManually,
    cancelManualScript,
    clearTabConsole,
  } = useScriptingStore();
  const { setActiveView } = useAppStore();

  const [scriptTab, setScriptTab] = useState<'pre-request' | 'test'>('pre-request');
  const [isSnippetsOpen, setIsSnippetsOpen] = useState(false);
  const [showConsole, setShowConsole] = useState(true);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const currentStage = scriptTab === 'pre-request' ? 'pre-request' : 'post-response';
  const currentCode = request
    ? scriptTab === 'pre-request'
      ? request.scripts?.preRequest?.script ?? request.preRequestScript ?? ''
      : request.scripts?.postResponse?.script ?? request.testScript ?? ''
    : '';

  // Debounced QuickJS syntax check to drive Monaco error markers
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const diag = await validateScriptSyntax(currentCode);
      if (cancelled) return;
      const ed = editorRef.current;
      const monaco = monacoRef.current;
      const model = ed?.getModel();
      if (ed && monaco && model) {
        if (diag.valid) {
          monaco.editor.setModelMarkers(model, 'quickjs-validator', []);
        } else {
          const line = diag.line || 1;
          monaco.editor.setModelMarkers(model, 'quickjs-validator', [
            {
              severity: monaco.MarkerSeverity.Error,
              message: diag.message || 'Syntax Error',
              startLineNumber: line,
              startColumn: diag.column || 1,
              endLineNumber: line,
              endColumn: model.getLineMaxColumn(Math.min(line, model.getLineCount())),
            },
          ]);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentCode, request, scriptTab]);

  if (!request) return null;

  const preRequestEnabled = request.scripts?.preRequest?.enabled ?? true;
  const postResponseEnabled = request.scripts?.postResponse?.enabled ?? true;
  const preFailurePolicy: ScriptFailurePolicy = request.scripts?.preRequest?.failurePolicy ?? 'halt';

  const isCurrentEnabled = scriptTab === 'pre-request' ? preRequestEnabled : postResponseEnabled;
  const isExecuting = Boolean(isExecutingByTab[activeTabId]);
  const lastStageResult = lastResultByTabStage[`${activeTabId}:${currentStage}`];
  const tabLogs = consoleLogsByTab[activeTabId] || [];

  const handleCodeChange = (val: string | undefined) => {
    const code = val || '';
    if (scriptTab === 'pre-request') {
      updateActiveRequest({
        preRequestScript: code,
        scripts: {
          ...(request.scripts || {
            postResponse: { script: request.testScript || '', enabled: true },
          }),
          preRequest: {
            script: code,
            enabled: preRequestEnabled,
            failurePolicy: preFailurePolicy,
          },
        },
      });
    } else {
      updateActiveRequest({
        testScript: code,
        scripts: {
          ...(request.scripts || {
            preRequest: { script: request.preRequestScript || '', enabled: true },
          }),
          postResponse: { script: code, enabled: postResponseEnabled },
        },
      });
    }
  };

  const handleToggleEnabled = (enabled: boolean) => {
    if (scriptTab === 'pre-request') {
      updateActiveRequest({
        scripts: {
          ...(request.scripts || {
            postResponse: { script: request.testScript || '', enabled: true },
          }),
          preRequest: { script: currentCode, enabled, failurePolicy: preFailurePolicy },
        },
      });
    } else {
      updateActiveRequest({
        scripts: {
          ...(request.scripts || {
            preRequest: { script: request.preRequestScript || '', enabled: true },
          }),
          postResponse: { script: currentCode, enabled },
        },
      });
    }
  };

  const handleFailurePolicyChange = (policy: ScriptFailurePolicy) => {
    updateActiveRequest({
      scripts: {
        ...(request.scripts || {
          postResponse: { script: request.testScript || '', enabled: true },
        }),
        preRequest: { script: currentCode, enabled: preRequestEnabled, failurePolicy: policy },
      },
    });
  };

  const handleClearScript = () => {
    handleCodeChange('');
  };

  const insertSnippet = (snippet: string) => {
    const nextCode = (currentCode.trim() ? currentCode + '\n\n' : '') + snippet;
    handleCodeChange(nextCode);
    setIsSnippetsOpen(false);
  };

  const stageTemplates = templates.filter((t) =>
    scriptTab === 'pre-request' ? t.stage === 'pre-request' : t.stage !== 'pre-request'
  );

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Script Tab Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 bg-slate-900/30 dark:bg-slate-900/30 light:bg-slate-50 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScriptTab('pre-request')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              scriptTab === 'pre-request'
                ? 'bg-blue-600/25 text-cyan-300 dark:text-cyan-300 light:text-blue-700 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 light:hover:text-slate-800'
            }`}
          >
            <span>Pre-request Script</span>
            {!preRequestEnabled && (
              <span className="text-[10px] text-slate-500 font-mono">(off)</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setScriptTab('test')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              scriptTab === 'test'
                ? 'bg-blue-600/25 text-cyan-300 dark:text-cyan-300 light:text-blue-700 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 light:hover:text-slate-800'
            }`}
          >
            <span>Post-response Script</span>
            {!postResponseEnabled && (
              <span className="text-[10px] text-slate-500 font-mono">(off)</span>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 dark:text-slate-300 light:text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isCurrentEnabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
              className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900"
            />
            <span>Active</span>
          </label>

          {scriptTab === 'pre-request' && (
            <select
              value={preFailurePolicy}
              onChange={(e) => handleFailurePolicyChange(e.target.value as ScriptFailurePolicy)}
              title="Pre-request failure policy"
              className="px-2 py-1 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-white border border-slate-700/70 dark:border-slate-700/70 light:border-slate-300 text-[11px] text-slate-300 dark:text-slate-300 light:text-slate-700"
            >
              <option value="halt">On error: Halt request</option>
              <option value="continue">On error: Continue request</option>
            </select>
          )}

          {/* Run / Cancel Script */}
          {isExecuting ? (
            <button
              type="button"
              onClick={() => cancelManualScript(activeTabId)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runScriptManually(activeTabId, currentStage, request, activeResponse)}
              title="Execute this script inside the QuickJS sandbox"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-emerald-600/20 text-emerald-300 dark:text-emerald-300 light:text-emerald-700 border border-emerald-500/30 hover:bg-emerald-600/30 cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Run Script</span>
            </button>
          )}

          {/* Snippet template dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSnippetsOpen(!isSnippetsOpen)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-cyan-300 hover:bg-slate-800/50 rounded transition-colors cursor-pointer border border-slate-700/60 dark:border-slate-700/60 light:border-slate-300"
            >
              <span>Templates</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isSnippetsOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 rounded-lg bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white border border-blue-500/25 shadow-2xl py-1 z-50">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>{scriptTab === 'pre-request' ? 'Pre-request' : 'Post-response'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSnippetsOpen(false);
                      setActiveView('templates');
                    }}
                    className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer normal-case"
                  >
                    <BookOpen className="w-3 h-3" />
                    Library
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {stageTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => insertSnippet(tpl.code)}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 text-slate-200 dark:text-slate-200 light:text-slate-800 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      <div className="font-medium truncate">{tpl.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{tpl.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowConsole((v) => !v)}
            title="Toggle Script Console"
            className={`p-1 rounded transition-colors cursor-pointer ${
              showConsole ? 'text-cyan-400 bg-slate-800/70' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleClearScript}
            title="Clear Script"
            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Monaco JS editor */}
      <div className="flex-1 min-h-[160px]">
        <Editor
          height="100%"
          language="javascript"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={currentCode}
          onMount={handleEditorMount}
          onChange={handleCodeChange}
          options={{
            fontSize: editorSettings.fontSize,
            tabSize: editorSettings.tabSize,
            wordWrap: editorSettings.wordWrap,
            lineNumbers: editorSettings.lineNumbers,
            matchBrackets: 'always',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderLineHighlight: 'all',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        />
      </div>

      {/* Status + Console */}
      <ScriptExecutionStatus isRunning={isExecuting} result={lastStageResult} />
      {showConsole && (
        <ScriptConsole logs={tabLogs} onClear={() => clearTabConsole(activeTabId)} />
      )}
    </div>
  );
};
