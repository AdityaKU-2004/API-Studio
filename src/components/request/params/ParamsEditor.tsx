import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  Table as TableIcon,
  RefreshCw,
} from 'lucide-react';
import { KeyValueItem } from '../../../types';
import { useRequestStore } from '../../../stores/requestStore';
import { buildUrlWithParams, parseUrl } from '../../../services/request/urlBuilder';

export const ParamsEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const params = request.params || [];

  const handleUpdate = (id: string, updates: Partial<KeyValueItem>) => {
    const updated = params.map((item) => (item.id === id ? { ...item, ...updates } : item));
    // Synchronize to URL
    updateActiveRequest({ params: updated }, true);
  };

  const handleAdd = () => {
    const newItem: KeyValueItem = {
      id: 'p-' + Date.now() + Math.random().toString(36).substring(2, 6),
      key: '',
      value: '',
      description: '',
      enabled: true,
    };
    updateActiveRequest({ params: [...params, newItem] }, true);
  };

  const handleDelete = (id: string) => {
    const remaining = params.filter((item) => item.id !== id);
    updateActiveRequest({ params: remaining }, true);
  };

  const handleDuplicate = (id: string) => {
    const targetIdx = params.findIndex((p) => p.id === id);
    if (targetIdx === -1) return;
    const target = params[targetIdx];
    const duplicated: KeyValueItem = {
      ...target,
      id: 'p-' + Date.now() + Math.random().toString(36).substring(2, 6),
    };
    const updated = [...params];
    updated.splice(targetIdx + 1, 0, duplicated);
    updateActiveRequest({ params: updated }, true);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === params.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...params];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    updateActiveRequest({ params: updated }, true);
  };

  // Bulk Edit handling
  const handleToggleBulk = () => {
    if (!isBulkMode) {
      // Enter bulk mode: generate text from enabled and disabled params
      const lines = params
        .filter((p) => p.key)
        .map((p) => `${p.enabled ? '' : '// '}${p.key}: ${p.value}`);
      setBulkText(lines.join('\n'));
      setIsBulkMode(true);
    } else {
      // Exit bulk mode: parse lines
      const lines = bulkText.split('\n');
      const newParams: KeyValueItem[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let isEnabled = true;
        let content = trimmed;
        if (content.startsWith('//')) {
          isEnabled = false;
          content = content.substring(2).trim();
        }

        const colonIdx = content.indexOf(':');
        const eqIdx = content.indexOf('=');

        let key = '';
        let val = '';

        if (colonIdx !== -1) {
          key = content.substring(0, colonIdx).trim();
          val = content.substring(colonIdx + 1).trim();
        } else if (eqIdx !== -1) {
          key = content.substring(0, eqIdx).trim();
          val = content.substring(eqIdx + 1).trim();
        } else {
          key = content;
          val = '';
        }

        newParams.push({
          id: 'p-' + Math.random().toString(36).substring(2, 9),
          key,
          value: val,
          description: '',
          enabled: isEnabled,
        });
      }

      updateActiveRequest({ params: newParams }, true);
      setIsBulkMode(false);
    }
  };

  // Re-extract from URL if needed
  const handleImportFromUrl = () => {
    const parsed = parseUrl(request.url, params);
    updateActiveRequest({ params: parsed.params }, true);
  };

  return (
    <div className="p-3 space-y-3 select-none">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Query Parameters</span>
          <span className="text-[11px] text-slate-500 font-mono">
            ({params.filter((p) => p.enabled && p.key).length} active)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleImportFromUrl}
            title="Re-sync and extract query parameters from URL string"
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer border border-slate-700/60"
          >
            <RefreshCw className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Sync from URL</span>
          </button>

          <button
            type="button"
            onClick={handleToggleBulk}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors cursor-pointer border ${
              isBulkMode
                ? 'bg-blue-600/30 text-cyan-300 border-blue-500/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-700/60'
            }`}
          >
            {isBulkMode ? <TableIcon className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
            <span>{isBulkMode ? 'Key-Value Table' : 'Bulk Edit'}</span>
          </button>

          {!isBulkMode && (
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Parameter</span>
            </button>
          )}
        </div>
      </div>

      {isBulkMode ? (
        <div className="space-y-2">
          <textarea
            rows={8}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="key: value&#10;// disabled_key: value"
            className="w-full p-3 rounded-lg bg-slate-950 font-mono text-xs text-cyan-300 border border-slate-800 focus:outline-none focus:border-cyan-500 resize-none"
          />
          <div className="text-[11px] text-slate-500">
            One parameter per line formatted as <code>key: value</code> or <code>key=value</code>. Prefix with <code>//</code> to disable.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 font-sans">
              <tr>
                <th className="w-10 px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2 w-1/3">Key</th>
                <th className="px-3 py-2 w-1/3">Value</th>
                <th className="px-3 py-2">Description</th>
                <th className="w-24 px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {params.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No query parameters defined. Click &ldquo;Add Parameter&rdquo; or paste a query in the URL bar above.
                  </td>
                </tr>
              ) : (
                params.map((param, idx) => (
                  <tr key={param.id} className="hover:bg-slate-800/20 group">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={param.enabled}
                        onChange={(e) => handleUpdate(param.id, { enabled: e.target.checked })}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 cursor-pointer"
                        title={param.enabled ? 'Disable parameter' : 'Enable parameter'}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={param.key}
                        onChange={(e) => handleUpdate(param.id, { key: e.target.value })}
                        placeholder="key"
                        className={`w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded focus:bg-slate-900 focus:outline-none ${
                          param.enabled ? 'text-slate-200' : 'text-slate-500 line-through'
                        }`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={param.value}
                        onChange={(e) => handleUpdate(param.id, { value: e.target.value })}
                        placeholder="value"
                        className={`w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded focus:bg-slate-900 focus:outline-none ${
                          param.enabled ? 'text-cyan-300' : 'text-slate-500'
                        }`}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-sans">
                      <input
                        type="text"
                        value={param.description || ''}
                        onChange={(e) => handleUpdate(param.id, { description: e.target.value })}
                        placeholder="Description note"
                        className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-400 focus:bg-slate-900 focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleMove(idx, 'up')}
                          disabled={idx === 0}
                          title="Move parameter up"
                          className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(idx, 'down')}
                          disabled={idx === params.length - 1}
                          title="Move parameter down"
                          className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(param.id)}
                          title="Duplicate parameter"
                          className="p-1 rounded text-slate-500 hover:text-blue-400 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(param.id)}
                          title="Delete parameter"
                          className="p-1 rounded text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
