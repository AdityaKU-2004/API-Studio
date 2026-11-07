import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import { Code, Play, CheckCircle } from 'lucide-react';

export const ScriptsEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const { theme, editorSettings } = useUiStore();

  const [scriptTab, setScriptTab] = useState<'pre-request' | 'test'>('pre-request');

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const currentCode = scriptTab === 'pre-request' ? request.preRequestScript : request.testScript;

  const handleCodeChange = (val: string | undefined) => {
    if (scriptTab === 'pre-request') {
      updateActiveRequest({ preRequestScript: val || '' });
    } else {
      updateActiveRequest({ testScript: val || '' });
    }
  };

  const insertSnippet = (snippet: string) => {
    const nextCode = (currentCode ? currentCode + '\n\n' : '') + snippet;
    handleCodeChange(nextCode);
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Subtab selection & snippet triggers */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/30 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScriptTab('pre-request')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              scriptTab === 'pre-request'
                ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pre-request Script
          </button>
          <button
            type="button"
            onClick={() => setScriptTab('test')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              scriptTab === 'test'
                ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Post-response Tests
          </button>
        </div>

        {/* Quick snippet buttons */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">Snippets:</span>
          {scriptTab === 'pre-request' ? (
            <button
              type="button"
              onClick={() => insertSnippet('pm.variables.set("timestamp", Date.now());')}
              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 transition-colors cursor-pointer font-mono"
            >
              +Set Variable
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  insertSnippet(
                    'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});'
                  )
                }
                className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 transition-colors cursor-pointer font-mono"
              >
                +Status 200
              </button>
              <button
                type="button"
                onClick={() =>
                  insertSnippet(
                    'pm.test("Response time < 300ms", function () {\n  pm.expect(pm.response.responseTime).to.be.below(300);\n});'
                  )
                }
                className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 transition-colors cursor-pointer font-mono"
              >
                +Time &lt; 300ms
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor area */}
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
