import React, { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Send, Sparkles, Trash2, BookmarkPlus, Bookmark, AlertCircle } from 'lucide-react';
import {
  WebSocketMessageFormat,
  WebSocketMessageTemplate,
} from '../../types';
import { useUiStore } from '../../stores/uiStore';

interface WebSocketComposerProps {
  isConnected: boolean;
  templates: WebSocketMessageTemplate[];
  onSend: (payload: string, format: WebSocketMessageFormat, binaryBytes?: Uint8Array) => boolean;
  onSaveTemplate: (name: string, format: WebSocketMessageFormat, payload: string) => void;
  onDeleteTemplate: (id: string) => void;
}

function hexStringToBytes(hex: string): Uint8Array | null {
  const clean = hex.replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export const WebSocketComposer: React.FC<WebSocketComposerProps> = ({
  isConnected,
  templates,
  onSend,
  onSaveTemplate,
  onDeleteTemplate,
}) => {
  const { theme, editorSettings } = useUiStore();
  const [format, setFormat] = useState<WebSocketMessageFormat>('json');
  const [payload, setPayload] = useState<string>('{\n  "action": "ping",\n  "timestamp": 1700000000\n}');
  const [binaryInputMode, setBinaryInputMode] = useState<'utf8' | 'hex'>('utf8');
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const validationError = useMemo(() => {
    if (!payload.trim()) return null;
    if (format === 'json') {
      try {
        JSON.parse(payload);
        return null;
      } catch (err) {
        return err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON';
      }
    }
    if (format === 'binary' && binaryInputMode === 'hex') {
      return hexStringToBytes(payload) ? null : 'Invalid hex byte sequence (must be even hex pairs)';
    }
    return null;
  }, [format, payload, binaryInputMode]);

  const monacoLanguage =
    format === 'json' ? 'json' : format === 'xml' ? 'xml' : 'plaintext';

  const handleFormatJson = () => {
    if (format !== 'json') return;
    try {
      setPayload(JSON.stringify(JSON.parse(payload), null, 2));
    } catch {
      // ignore invalid json
    }
  };

  const handleSend = () => {
    if (!isConnected || validationError) return;
    if (format === 'binary') {
      const bytes =
        binaryInputMode === 'hex'
          ? hexStringToBytes(payload)
          : new TextEncoder().encode(payload);
      if (!bytes) return;
      onSend(payload, 'binary', bytes);
      return;
    }
    onSend(payload, format);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f131b] dark:bg-[#0f131b] light:bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/50 text-xs flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950/70 rounded-lg p-0.5 border border-slate-800">
            {(['json', 'text', 'xml', 'binary'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormat(fmt)}
                className={`px-2 py-0.5 rounded text-[11px] uppercase font-mono cursor-pointer transition-colors ${
                  format === fmt
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {format === 'binary' && (
            <select
              value={binaryInputMode}
              onChange={(e) => setBinaryInputMode(e.target.value as 'utf8' | 'hex')}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
            >
              <option value="utf8">UTF-8 Bytes</option>
              <option value="hex">Hex Pairs (e.g. 48 69)</option>
            </select>
          )}

          {format === 'json' && (
            <button
              type="button"
              onClick={handleFormatJson}
              className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer text-[11px]"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Format</span>
            </button>
          )}

          {validationError && (
            <span className="text-[11px] text-red-400 flex items-center gap-1 truncate max-w-[220px]">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {validationError}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Template Selector */}
          <div className="flex items-center gap-1">
            <Bookmark className="w-3.5 h-3.5 text-slate-400" />
            <select
              value=""
              onChange={(e) => {
                const tpl = templates.find((t) => t.id === e.target.value);
                if (tpl) {
                  setFormat(tpl.format);
                  setPayload(tpl.payload);
                }
              }}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 focus:outline-none"
            >
              <option value="" disabled>
                Templates ({templates.length})
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.format.toUpperCase()}] {t.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowSaveTemplate((s) => !s)}
            title="Save current message as template"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          <button
            type="button"
            onClick={() => setPayload('')}
            title="Clear message composer"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={!isConnected || !!validationError}
            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Send Message</span>
          </button>
        </div>
      </div>

      {/* Save template inline bar */}
      {showSaveTemplate && (
        <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-950/70 flex items-center gap-2 text-xs shrink-0">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name (e.g. Subscribe Market Feed)"
            className="flex-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={() => {
              if (!templateName.trim()) return;
              onSaveTemplate(templateName.trim(), format, payload);
              setTemplateName('');
              setShowSaveTemplate(false);
            }}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
          >
            Save Template
          </button>
          {templates.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) onDeleteTemplate(e.target.value);
              }}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-red-300"
            >
              <option value="">Delete template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  Delete: {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Monaco Composer */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={monacoLanguage}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={payload}
          onChange={(v) => setPayload(v ?? '')}
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
