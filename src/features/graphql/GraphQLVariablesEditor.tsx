import React, { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateGraphQLVariables } from '../../services/protocols/graphql/graphqlFormatter';
import { useUiStore } from '../../stores/uiStore';

interface GraphQLVariablesEditorProps {
  variablesText: string;
  onChange: (nextText: string) => void;
}

export const GraphQLVariablesEditor: React.FC<GraphQLVariablesEditorProps> = ({
  variablesText,
  onChange,
}) => {
  const { theme, editorSettings } = useUiStore();
  const validation = useMemo(() => validateGraphQLVariables(variablesText), [variablesText]);

  const handleFormatJson = () => {
    if (!variablesText.trim()) {
      onChange('{}');
      return;
    }
    try {
      const parsed = JSON.parse(variablesText);
      onChange(JSON.stringify(parsed, null, 2));
    } catch {
      // leave text unchanged on syntax error
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f131b] dark:bg-[#0f131b] light:bg-white">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/60 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Variables (JSON)</span>
          {validation.valid ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Valid JSON
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-red-400 truncate max-w-[220px]">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {validation.error}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleFormatJson}
          className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 flex items-center gap-1 cursor-pointer text-[11px]"
        >
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Format</span>
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="json"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={variablesText}
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
    </div>
  );
};
