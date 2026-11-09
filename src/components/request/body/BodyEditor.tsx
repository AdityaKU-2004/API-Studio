import React, { useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Sparkles,
  Minimize2,
  Trash2,
  Upload,
  Plus,
  File,
  X,
  Code2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { BodyType, FormDataItem, KeyValueItem, BinaryBody } from '../../../types';
import { useRequestStore } from '../../../stores/requestStore';
import { useUiStore } from '../../../stores/uiStore';

export const BodyEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const { theme, editorSettings } = useUiStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const currentMode: BodyType = request.bodyType || 'none';
  const rawContentMap = request.body?.rawContent || {
    json: request.rawBody || '',
    text: '',
    xml: '',
    html: '',
  };

  const currentRawContent =
    rawContentMap[currentMode] !== undefined ? rawContentMap[currentMode] : request.rawBody || '';

  const handleModeChange = (mode: BodyType) => {
    // Preserve existing content and update mode
    let nextRaw = rawContentMap[mode] || '';

    if (mode === 'json' && !nextRaw) {
      nextRaw = '{\n  "name": "Acme User",\n  "status": "active"\n}';
    } else if (mode === 'xml' && !nextRaw) {
      nextRaw = '<?xml version="1.0" encoding="UTF-8"?>\n<request>\n  <id>1</id>\n</request>';
    } else if (mode === 'html' && !nextRaw) {
      nextRaw = '<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Hello API Studio</h1>\n  </body>\n</html>';
    }

    const updatedRawMap = {
      ...rawContentMap,
      [currentMode]: currentRawContent,
      [mode]: nextRaw,
    };

    updateActiveRequest({
      bodyType: mode,
      rawBody: nextRaw,
      body: {
        ...(request.body || { formData: [], urlEncoded: [], binary: {} }),
        mode,
        rawContent: updatedRawMap,
      },
    });
  };

  const handleCodeChange = (value: string | undefined) => {
    const val = value || '';
    updateActiveRequest({
      rawBody: val,
      body: {
        ...(request.body || { formData: [], urlEncoded: [], binary: {} }),
        mode: currentMode,
        rawContent: {
          ...rawContentMap,
          [currentMode]: val,
        },
      },
    });
  };

  const handleFormatJson = () => {
    try {
      if (currentRawContent) {
        const parsed = JSON.parse(currentRawContent);
        handleCodeChange(JSON.stringify(parsed, null, editorSettings.tabSize || 2));
      }
    } catch {
      // Ignore formatting on invalid syntax
    }
  };

  const handleMinifyJson = () => {
    try {
      if (currentRawContent) {
        const parsed = JSON.parse(currentRawContent);
        handleCodeChange(JSON.stringify(parsed));
      }
    } catch {
      // Ignore
    }
  };

  const handleClearEditor = () => {
    handleCodeChange('');
  };

  // Form Data Handlers
  const handleAddFormData = () => {
    const newItem: FormDataItem = {
      id: 'fd-' + Date.now() + Math.random().toString(36).substring(2, 6),
      key: '',
      value: '',
      type: 'text',
      enabled: true,
    };
    updateActiveRequest({ formData: [...(request.formData || []), newItem] });
  };

  const handleUpdateFormData = (id: string, updates: Partial<FormDataItem>) => {
    const updated = (request.formData || []).map((item) => (item.id === id ? { ...item, ...updates } : item));
    updateActiveRequest({ formData: updated });
  };

  const handleDeleteFormData = (id: string) => {
    const remaining = (request.formData || []).filter((item) => item.id !== id);
    updateActiveRequest({ formData: remaining });
  };

  // Binary File Handlers
  const handleBinaryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const binaryData: BinaryBody = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      };

      updateActiveRequest({
        body: {
          ...(request.body || { rawContent: {}, formData: [], urlEncoded: {} }),
          mode: 'binary',
          binary: binaryData,
        },
      });
    }
  };

  const handleRemoveBinaryFile = () => {
    updateActiveRequest({
      body: {
        ...(request.body || { rawContent: {}, formData: [], urlEncoded: {} }),
        mode: 'binary',
        binary: {},
      },
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // URL Encoded Handlers
  const handleAddUrlEncoded = () => {
    const newItem: KeyValueItem = {
      id: 'ue-' + Date.now(),
      key: '',
      value: '',
      enabled: true,
    };
    updateActiveRequest({ urlEncoded: [...(request.urlEncoded || []), newItem] });
  };

  const handleUpdateUrlEncoded = (id: string, updates: Partial<KeyValueItem>) => {
    const updated = (request.urlEncoded || []).map((item) => (item.id === id ? { ...item, ...updates } : item));
    updateActiveRequest({ urlEncoded: updated });
  };

  const handleDeleteUrlEncoded = (id: string) => {
    const remaining = (request.urlEncoded || []).filter((item) => item.id !== id);
    updateActiveRequest({ urlEncoded: remaining });
  };

  const bodyModes: { id: BodyType; label: string }[] = [
    { id: 'none', label: 'none' },
    { id: 'json', label: 'JSON' },
    { id: 'text', label: 'Text' },
    { id: 'xml', label: 'XML' },
    { id: 'html', label: 'HTML' },
    { id: 'form-data', label: 'form-data' },
    { id: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
    { id: 'binary', label: 'binary' },
  ];

  const getMonacoLanguage = () => {
    if (currentMode === 'json') return 'json';
    if (currentMode === 'xml') return 'xml';
    if (currentMode === 'html') return 'html';
    return 'plaintext';
  };

  // JSON syntax validation check
  const isJsonValid = React.useMemo(() => {
    if (currentMode !== 'json' || !currentRawContent.trim()) return true;
    try {
      JSON.parse(currentRawContent);
      return true;
    } catch {
      return false;
    }
  }, [currentMode, currentRawContent]);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Sub-toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/30 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {bodyModes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleModeChange(m.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                currentMode === m.id
                  ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Code actions for code modes */}
        {(currentMode === 'json' || currentMode === 'xml' || currentMode === 'html' || currentMode === 'text') && (
          <div className="flex items-center gap-1.5">
            {currentMode === 'json' && (
              <>
                <span
                  className={`flex items-center gap-1 text-[11px] font-mono mr-2 ${
                    isJsonValid ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isJsonValid ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      <span>Valid JSON</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      <span>Invalid JSON</span>
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={handleFormatJson}
                  title="Format JSON"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-300 hover:text-cyan-300 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Format</span>
                </button>

                <button
                  type="button"
                  onClick={handleMinifyJson}
                  title="Minify JSON"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-300 hover:text-cyan-300 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Minimize2 className="w-3 h-3 text-blue-400" />
                  <span>Minify</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleClearEditor}
              title="Clear Editor"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-red-400 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor viewport */}
      <div className="flex-1 min-h-[220px]">
        {currentMode === 'none' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
            <Code2 className="w-8 h-8 text-slate-600 mb-2 stroke-1" />
            <p className="text-slate-300 font-medium">This request does not have a body.</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Select JSON, XML, Form Data, or Binary above to configure request payload.
            </p>
          </div>
        )}

        {(currentMode === 'json' || currentMode === 'text' || currentMode === 'xml' || currentMode === 'html') && (
          <div className="h-full min-h-[220px]">
            <Editor
              height="100%"
              language={getMonacoLanguage()}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              value={currentRawContent}
              onChange={handleCodeChange}
              options={{
                fontSize: editorSettings.fontSize,
                tabSize: editorSettings.tabSize,
                wordWrap: editorSettings.wordWrap,
                lineNumbers: editorSettings.lineNumbers,
                minimap: { enabled: editorSettings.minimap },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                renderLineHighlight: 'all',
                overviewRulerBorder: false,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>
        )}

        {currentMode === 'form-data' && (
          <div className="p-3 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Multipart Form Fields</span>
              <button
                type="button"
                onClick={handleAddFormData}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Form Field</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase border-b border-slate-800 font-sans">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center">Active</th>
                    <th className="px-3 py-2 w-1/3">Key</th>
                    <th className="px-3 py-2 w-1/3">Value / File</th>
                    <th className="px-3 py-2 w-28">Type</th>
                    <th className="w-10 px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {(request.formData || []).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/20">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => handleUpdateFormData(item.id, { enabled: e.target.checked })}
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => handleUpdateFormData(item.id, { key: e.target.value })}
                          placeholder="field_name"
                          className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-200 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {item.type === 'file' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpdateFormData(item.id, {
                                    value: file.name,
                                    file: { name: file.name, size: file.size, type: file.type },
                                  });
                                }
                              }}
                              className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-cyan-300 hover:file:bg-slate-700"
                            />
                            {item.file && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({(item.file.size / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={item.value}
                            onChange={(e) => handleUpdateFormData(item.id, { value: e.target.value })}
                            placeholder="value"
                            className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-cyan-300 focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-sans">
                        <select
                          value={item.type}
                          onChange={(e) => handleUpdateFormData(item.id, { type: e.target.value as any })}
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 focus:outline-none cursor-pointer"
                        >
                          <option value="text">Text</option>
                          <option value="file">File</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteFormData(item.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentMode === 'x-www-form-urlencoded' && (
          <div className="p-3 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">URL-Encoded Form Data</span>
              <button
                type="button"
                onClick={handleAddUrlEncoded}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase border-b border-slate-800 font-sans">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center">Active</th>
                    <th className="px-3 py-2 w-1/2">Key</th>
                    <th className="px-3 py-2 w-1/2">Value</th>
                    <th className="w-10 px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {(request.urlEncoded || []).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/20">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => handleUpdateUrlEncoded(item.id, { enabled: e.target.checked })}
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => handleUpdateUrlEncoded(item.id, { key: e.target.value })}
                          placeholder="key"
                          className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-200 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => handleUpdateUrlEncoded(item.id, { value: e.target.value })}
                          placeholder="value"
                          className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-cyan-300 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteUrlEncoded(item.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentMode === 'binary' && (
          <div className="p-6 max-w-lg mx-auto text-center space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleBinaryFileSelect}
              className="hidden"
            />

            {request.body?.binary?.fileName ? (
              <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300">
                    <File className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 text-xs font-mono">
                      {request.body.binary.fileName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {request.body.binary.fileSize
                        ? `${(request.body.binary.fileSize / 1024).toFixed(1)} KB`
                        : '0 KB'}{' '}
                      · {request.body.binary.fileType || 'binary'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveBinaryFile}
                  title="Remove selected file"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl cursor-pointer hover:bg-slate-900/40 transition-all space-y-3"
              >
                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800/80 flex items-center justify-center text-cyan-400">
                  <Upload className="w-6 h-6 stroke-1" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Choose a file to send as binary body
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Supports any binary stream (images, documents, archives, blobs)
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-cyan-300 border border-blue-500/30 text-xs font-medium cursor-pointer"
                >
                  Select File
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
