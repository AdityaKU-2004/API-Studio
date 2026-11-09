import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  Table as TableIcon,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { KeyValueItem } from '../../../types';
import { useRequestStore } from '../../../stores/requestStore';

const commonHeaderSuggestions = [
  { key: 'Authorization', defaultValue: 'Bearer {{auth_token}}', desc: 'Authentication credentials' },
  { key: 'Content-Type', defaultValue: 'application/json', desc: 'MIME type of the body' },
  { key: 'Accept', defaultValue: 'application/json', desc: 'Expected response format' },
  { key: 'User-Agent', defaultValue: 'API Studio/2.0', desc: 'Client application name' },
  { key: 'Cache-Control', defaultValue: 'no-cache', desc: 'Cache directive' },
  { key: 'Origin', defaultValue: 'https://example.com', desc: 'Origin of request' },
  { key: 'Referer', defaultValue: 'https://example.com', desc: 'Address of prior resource' },
  { key: 'X-API-Key', defaultValue: '{{api_key}}', desc: 'Custom API Key' },
  { key: 'X-Request-ID', defaultValue: 'req-{{$timestamp}}', desc: 'Trace identifier' },
];

export const HeadersEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const headers = request.headers || [];

  // Detect duplicate enabled headers
  const duplicateHeaderKeys = new Set<string>();
  const seenKeys = new Set<string>();
  for (const h of headers) {
    if (h.enabled && h.key.trim()) {
      const lower = h.key.trim().toLowerCase();
      if (seenKeys.has(lower)) {
        duplicateHeaderKeys.add(lower);
      }
      seenKeys.add(lower);
    }
  }

  const handleUpdate = (id: string, updates: Partial<KeyValueItem>) => {
    const updated = headers.map((item) => (item.id === id ? { ...item, ...updates } : item));
    updateActiveRequest({ headers: updated });
  };

  const handleAdd = (key = '', value = '', description = '') => {
    const newItem: KeyValueItem = {
      id: 'h-' + Date.now() + Math.random().toString(36).substring(2, 6),
      key,
      value,
      description,
      enabled: true,
    };
    updateActiveRequest({ headers: [...headers, newItem] });
  };

  const handleDelete = (id: string) => {
    const remaining = headers.filter((item) => item.id !== id);
    updateActiveRequest({ headers: remaining });
  };

  const handleDuplicate = (id: string) => {
    const targetIdx = headers.findIndex((h) => h.id === id);
    if (targetIdx === -1) return;
    const target = headers[targetIdx];
    const duplicated: KeyValueItem = {
      ...target,
      id: 'h-' + Date.now() + Math.random().toString(36).substring(2, 6),
    };
    const updated = [...headers];
    updated.splice(targetIdx + 1, 0, duplicated);
    updateActiveRequest({ headers: updated });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === headers.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...headers];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    updateActiveRequest({ headers: updated });
  };

  const handleToggleBulk = () => {
    if (!isBulkMode) {
      const lines = headers
        .filter((h) => h.key)
        .map((h) => `${h.enabled ? '' : '// '}${h.key}: ${h.value}`);
      setBulkText(lines.join('\n'));
      setIsBulkMode(true);
    } else {
      const lines = bulkText.split('\n');
      const newHeaders: KeyValueItem[] = [];

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
        let key = '';
        let val = '';

        if (colonIdx !== -1) {
          key = content.substring(0, colonIdx).trim();
          val = content.substring(colonIdx + 1).trim();
        } else {
          key = content;
          val = '';
        }

        newHeaders.push({
          id: 'h-' + Math.random().toString(36).substring(2, 9),
          key,
          value: val,
          description: '',
          enabled: isEnabled,
        });
      }

      updateActiveRequest({ headers: newHeaders });
      setIsBulkMode(false);
    }
  };

  return (
    <div className="p-3 space-y-3 select-none">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Request Headers</span>
          <span className="text-[11px] text-slate-500 font-mono">
            ({headers.filter((h) => h.enabled && h.key).length} active)
          </span>

          {duplicateHeaderKeys.size > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <AlertTriangle className="w-3 h-3" />
              <span>Duplicate header detected</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Header Presets Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSuggestionsOpen(!isSuggestionsOpen)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer border border-slate-700/60"
            >
              <span>+ Header Presets</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isSuggestionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 border border-blue-500/25 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Common Headers
                </div>
                {commonHeaderSuggestions.map((sug) => (
                  <button
                    key={sug.key}
                    type="button"
                    onClick={() => {
                      handleAdd(sug.key, sug.defaultValue, sug.desc);
                      setIsSuggestionsOpen(false);
                    }}
                    className="w-full flex flex-col px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 transition-colors cursor-pointer"
                  >
                    <span className="font-mono text-cyan-300 font-medium">{sug.key}</span>
                    <span className="text-[10px] text-slate-400 truncate">{sug.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
              onClick={() => handleAdd()}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Header</span>
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
            placeholder="Content-Type: application/json&#10;// Accept: text/html"
            className="w-full p-3 rounded-lg bg-slate-950 font-mono text-xs text-cyan-300 border border-slate-800 focus:outline-none focus:border-cyan-500 resize-none"
          />
          <div className="text-[11px] text-slate-500">
            One header per line formatted as <code>Header-Name: header_value</code>. Prefix with <code>//</code> to disable.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 font-sans">
              <tr>
                <th className="w-10 px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2 w-1/3">Header Name</th>
                <th className="px-3 py-2 w-1/3">Header Value</th>
                <th className="px-3 py-2">Description</th>
                <th className="w-24 px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {headers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No headers configured. Default headers like <code>Content-Type: application/json</code> can be added above.
                  </td>
                </tr>
              ) : (
                headers.map((header, idx) => {
                  const isDuplicate = header.enabled && duplicateHeaderKeys.has(header.key.trim().toLowerCase());
                  return (
                    <tr
                      key={header.id}
                      className={`hover:bg-slate-800/20 group ${isDuplicate ? 'bg-amber-500/5' : ''}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={header.enabled}
                          onChange={(e) => handleUpdate(header.id, { enabled: e.target.checked })}
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="relative">
                          <input
                            type="text"
                            value={header.key}
                            onChange={(e) => handleUpdate(header.id, { key: e.target.value })}
                            placeholder="Header-Name"
                            className={`w-full px-2 py-1 bg-transparent border rounded focus:bg-slate-900 focus:outline-none ${
                              isDuplicate
                                ? 'border-amber-500 text-amber-300'
                                : 'border-transparent focus:border-cyan-500 text-slate-200'
                            } ${!header.enabled ? 'text-slate-500 line-through' : ''}`}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => handleUpdate(header.id, { value: e.target.value })}
                          placeholder="value"
                          className={`w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded focus:bg-slate-900 focus:outline-none ${
                            header.enabled ? 'text-cyan-300' : 'text-slate-500'
                          }`}
                        />
                      </td>
                      <td className="px-2 py-1.5 font-sans">
                        <input
                          type="text"
                          value={header.description || ''}
                          onChange={(e) => handleUpdate(header.id, { description: e.target.value })}
                          placeholder="Description"
                          className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-400 focus:bg-slate-900 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0}
                            title="Move header up"
                            className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === headers.length - 1}
                            title="Move header down"
                            className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(header.id)}
                            title="Duplicate header"
                            className="p-1 rounded text-slate-500 hover:text-blue-400 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(header.id)}
                            title="Delete header"
                            className="p-1 rounded text-slate-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
