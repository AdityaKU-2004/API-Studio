import React, { Suspense } from 'react';
import Editor from '@monaco-editor/react';
import { Sparkles, Plus, Trash2, Code2 } from 'lucide-react';
import { BodyType, FormDataItem, KeyValueItem } from '../../types';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';

export const BodyEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const { theme, editorSettings } = useUiStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const handleBodyTypeChange = (bodyType: BodyType) => {
    let raw = request.rawBody;
    if (bodyType === 'json' && !raw) {
      raw = JSON.stringify({ name: 'Acme Item', active: true }, null, 2);
    } else if (bodyType === 'xml' && !raw) {
      raw = '<?xml version="1.0" encoding="UTF-8"?>\n<request>\n  <id>1</id>\n</request>';
    }
    updateActiveRequest({ bodyType, rawBody: raw });
  };

  const handleBeautifyJson = () => {
    try {
      if (request.rawBody) {
        const parsed = JSON.parse(request.rawBody);
        updateActiveRequest({ rawBody: JSON.stringify(parsed, null, 2) });
      }
    } catch {
      // Ignore syntax errors during formatting
    }
  };

  // Form Data helpers
  const handleAddFormData = () => {
    const newItem: FormDataItem = {
      id: 'fd-' + Date.now(),
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

  // Url Encoded helpers
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

  const bodyTypes: { id: BodyType; label: string }[] = [
    { id: 'none', label: 'none' },
    { id: 'json', label: 'JSON' },
    { id: 'text', label: 'Text' },
    { id: 'xml', label: 'XML' },
    { id: 'form-data', label: 'form-data' },
    { id: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
  ];

  const getMonacoLanguage = () => {
    if (request.bodyType === 'json') return 'json';
    if (request.bodyType === 'xml') return 'xml';
    return 'plaintext';
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Sub-toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/30 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {bodyTypes.map((bt) => (
            <button
              key={bt.id}
              type="button"
              onClick={() => handleBodyTypeChange(bt.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                request.bodyType === bt.id
                  ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {bt.label}
            </button>
          ))}
        </div>

        {request.bodyType === 'json' && (
          <button
            type="button"
            onClick={handleBeautifyJson}
            title="Format / Beautify JSON"
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-slate-300 hover:text-cyan-300 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Beautify</span>
          </button>
        )}
      </div>

      {/* Body Content */}
      <div className="flex-1 min-h-[220px]">
        {request.bodyType === 'none' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
            <Code2 className="w-8 h-8 text-slate-600 mb-2 stroke-1" />
            <p>This request does not have a body payload.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Select JSON, Text, or Form Data above to configure request parameters.
            </p>
          </div>
        )}

        {(request.bodyType === 'json' || request.bodyType === 'text' || request.bodyType === 'xml') && (
          <div className="h-full min-h-[220px]">
            <Editor
              height="100%"
              language={getMonacoLanguage()}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              value={request.rawBody}
              onChange={(value) => updateActiveRequest({ rawBody: value || '' })}
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

        {request.bodyType === 'form-data' && (
          <div className="p-3 space-y-3">
            <div className="flex justify-end">
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
                <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center">Active</th>
                    <th className="px-3 py-2 w-1/3">Key</th>
                    <th className="px-3 py-2 w-1/3">Value</th>
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
                          placeholder="field"
                          className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-200 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => handleUpdateFormData(item.id, { value: e.target.value })}
                          placeholder="value"
                          className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-cyan-300 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5 font-sans">
                        <select
                          value={item.type}
                          onChange={(e) => handleUpdateFormData(item.id, { type: e.target.value as any })}
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 focus:outline-none"
                        >
                          <option value="text">Text</option>
                          <option value="file">File</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteFormData(item.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400"
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

        {request.bodyType === 'x-www-form-urlencoded' && (
          <div className="p-3 space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddUrlEncoded}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add URL-Encoded Field</span>
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase border-b border-slate-800">
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
                          className="p-1 rounded text-slate-500 hover:text-red-400"
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
      </div>
    </div>
  );
};
