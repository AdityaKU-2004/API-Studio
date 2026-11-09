import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useRequestStore } from '../../../stores/requestStore';
import { useUiStore } from '../../../stores/uiStore';
import { Trash2, CheckCircle, Code, Plus, ChevronDown } from 'lucide-react';

export const ScriptsEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const { theme, editorSettings } = useUiStore();

  const [scriptTab, setScriptTab] = useState<'pre-request' | 'test'>('pre-request');
  const [isSnippetsOpen, setIsSnippetsOpen] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const preRequestEnabled = request.scripts?.preRequest?.enabled ?? true;
  const postResponseEnabled = request.scripts?.postResponse?.enabled ?? true;

  const currentCode =
    scriptTab === 'pre-request'
      ? request.scripts?.preRequest?.script ?? request.preRequestScript ?? ''
      : request.scripts?.postResponse?.script ?? request.testScript ?? '';

  const isCurrentEnabled = scriptTab === 'pre-request' ? preRequestEnabled : postResponseEnabled;

  const handleCodeChange = (val: string | undefined) => {
    const code = val || '';
    if (scriptTab === 'pre-request') {
      updateActiveRequest({
        preRequestScript: code,
        scripts: {
          ...(request.scripts || {
            postResponse: { script: request.testScript || '', enabled: true },
          }),
          preRequest: { script: code, enabled: preRequestEnabled },
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
          preRequest: { script: currentCode, enabled },
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

  const handleClearScript = () => {
    handleCodeChange('');
  };

  const insertSnippet = (snippet: string) => {
    const nextCode = (currentCode.trim() ? currentCode + '\n\n' : '') + snippet;
    handleCodeChange(nextCode);
    setIsSnippetsOpen(false);
  };

  const preRequestTemplates = [
    {
      title: 'Set Environment Variable',
      code: 'pm.environment.set("current_timestamp", Date.now());',
    },
    {
      title: 'Generate Random UUID',
      code: 'const uuid = "usr_" + Math.random().toString(36).substring(2, 10);\npm.variables.set("trace_id", uuid);',
    },
    {
      title: 'Get Environment Variable',
      code: 'const baseUrl = pm.environment.get("base_url");\nconsole.log("Current Base URL:", baseUrl);',
    },
  ];

  const postResponseTemplates = [
    {
      title: 'Status Code is 200',
      code: 'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});',
    },
    {
      title: 'Response time is below 500ms',
      code: 'pm.test("Response time is less than 500ms", function () {\n  pm.expect(pm.response.responseTime).to.be.below(500);\n});',
    },
    {
      title: 'Check JSON body property',
      code: 'pm.test("Has success property", function () {\n  const jsonData = pm.response.json();\n  pm.expect(jsonData).to.have.property("status");\n});',
    },
    {
      title: 'Store access token from response',
      code: 'const res = pm.response.json();\nif (res.accessToken) {\n  pm.environment.set("auth_token", res.accessToken);\n}',
    },
  ];

  return (
    <div className="flex flex-col h-full select-none">
      {/* Script Tab Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/30 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScriptTab('pre-request')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              scriptTab === 'pre-request'
                ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Pre-request Script</span>
            {!preRequestEnabled && (
              <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-500 font-mono">
                disabled
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setScriptTab('test')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              scriptTab === 'test'
                ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Post-response Script</span>
            {!postResponseEnabled && (
              <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-500 font-mono">
                disabled
              </span>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Active toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer mr-1">
            <input
              type="checkbox"
              checked={isCurrentEnabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
              className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900"
            />
            <span>Active</span>
          </label>

          {/* Snippet template dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSnippetsOpen(!isSnippetsOpen)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors cursor-pointer border border-slate-700/60"
            >
              <span>+ Script Templates</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isSnippetsOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 border border-blue-500/25 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {scriptTab === 'pre-request' ? 'Pre-request Snippets' : 'Testing Snippets'}
                </div>
                {(scriptTab === 'pre-request' ? preRequestTemplates : postResponseTemplates).map(
                  (tpl) => (
                    <button
                      key={tpl.title}
                      type="button"
                      onClick={() => insertSnippet(tpl.code)}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      {tpl.title}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

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
      <div className="flex-1 min-h-[220px]">
        <Editor
          height="100%"
          language="javascript"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={currentCode}
          onChange={handleCodeChange}
          options={{
            fontSize: editorSettings.fontSize,
            tabSize: editorSettings.tabSize,
            wordWrap: editorSettings.wordWrap,
            lineNumbers: editorSettings.lineNumbers,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderLineHighlight: 'all',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        />
      </div>
    </div>
  );
};
