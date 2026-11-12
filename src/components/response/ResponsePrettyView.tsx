import React, { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Check, Minimize2, Sparkles, AlertCircle, WrapText } from 'lucide-react';
import { ApiResponse } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { formatContent, minifyJson } from '../../utils/responseDetection';

interface ResponsePrettyViewProps {
  response: ApiResponse;
}

export const ResponsePrettyView: React.FC<ResponsePrettyViewProps> = ({ response }) => {
  const { theme, editorSettings } = useUiStore();
  const [copied, setCopied] = useState(false);
  const [isWordWrap, setIsWordWrap] = useState(editorSettings.wordWrap === 'on');
  const [overrideContent, setOverrideContent] = useState<string | null>(null);

  const category = response.contentTypeCategory;
  const isJson = category === 'json';

  const language = useMemo(() => {
    switch (category) {
      case 'json':
        return 'json';
      case 'xml':
        return 'xml';
      case 'html':
        return 'html';
      default:
        return 'plaintext';
    }
  }, [category]);

  const prettyText = useMemo(() => {
    if (overrideContent !== null) return overrideContent;
    return formatContent(response.body, category);
  }, [response.body, category, overrideContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(prettyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    setOverrideContent(formatContent(response.body, category));
  };

  const handleMinify = () => {
    if (isJson) {
      setOverrideContent(minifyJson(response.body));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/60 bg-slate-900/40 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          {isJson && (
            <>
              <button
                type="button"
                onClick={handleFormat}
                title="Format JSON"
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Format</span>
              </button>
              <button
                type="button"
                onClick={handleMinify}
                title="Minify JSON"
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Minimize2 className="w-3 h-3 text-blue-400" />
                <span>Minify</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsWordWrap(!isWordWrap)}
            title="Toggle Word Wrap"
            className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer ${
              isWordWrap
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <WrapText className="w-3 h-3" />
            <span>Wrap</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Body</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Parsing error notification banner if JSON was malformed */}
      {response.error?.type === 'parse_error' && (
        <div className="px-3 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Warning: Body contains invalid JSON formatting. Showing raw payload.</span>
        </div>
      )}

      {/* Monaco Editor Canvas */}
      <div className="flex-1 min-h-[220px]">
        <Editor
          height="100%"
          language={language}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={prettyText}
          options={{
            readOnly: true,
            fontSize: editorSettings.fontSize,
            lineNumbers: editorSettings.lineNumbers,
            minimap: { enabled: false },
            wordWrap: isWordWrap ? 'on' : 'off',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontFamily: 'JetBrains Mono, monospace',
            formatOnType: false,
            folding: true,
            find: {
              addExtraSpaceOnTop: false,
              autoFindInSelection: 'always',
              seedSearchStringFromSelection: 'always',
            },
          }}
        />
      </div>
    </div>
  );
};
