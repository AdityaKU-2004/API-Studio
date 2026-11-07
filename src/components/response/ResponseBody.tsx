import React from 'react';
import Editor from '@monaco-editor/react';
import { ApiResponse } from '../../types';
import { useUiStore } from '../../stores/uiStore';

interface ResponseBodyProps {
  response: ApiResponse;
}

export const ResponseBody: React.FC<ResponseBodyProps> = ({ response }) => {
  const { theme, responseBodyFormat, setResponseBodyFormat, editorSettings } = useUiStore();

  const isJson = response.contentType.includes('json');

  const prettyContent = React.useMemo(() => {
    if (!response.body) return '';
    try {
      const parsed = JSON.parse(response.body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return response.body;
    }
  }, [response.body]);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Sub-format toggles: Pretty / Raw / Preview */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/40 text-[11px]">
        <div className="flex items-center gap-1">
          {(['pretty', 'raw', 'preview'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setResponseBodyFormat(fmt)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition-colors cursor-pointer ${
                responseBodyFormat === fmt
                  ? 'bg-blue-600/30 text-cyan-300 font-semibold border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-slate-500 font-mono">
          {response.contentType}
        </span>
      </div>

      {/* Body Viewport */}
      <div className="flex-1 min-h-[220px]">
        {responseBodyFormat === 'pretty' && (
          <Editor
            height="100%"
            language={isJson ? 'json' : 'plaintext'}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={prettyContent}
            options={{
              readOnly: true,
              fontSize: editorSettings.fontSize,
              lineNumbers: editorSettings.lineNumbers,
              minimap: { enabled: false },
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        )}

        {responseBodyFormat === 'raw' && (
          <div className="p-4 font-mono text-xs text-slate-200 dark:text-slate-200 light:text-slate-900 overflow-auto h-full whitespace-pre-wrap select-text">
            {response.body || '(Empty body)'}
          </div>
        )}

        {responseBodyFormat === 'preview' && (
          <div className="p-4 overflow-auto h-full text-xs">
            {isJson ? (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-cyan-400">JSON Visual Tree Preview</span>
                <div className="p-4 rounded-lg bg-slate-950 font-mono text-xs text-emerald-300 border border-slate-800 overflow-x-auto">
                  <pre>{prettyContent}</pre>
                </div>
              </div>
            ) : (
              <div className="text-slate-400">
                HTML / Web preview not applicable for content-type {response.contentType}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
