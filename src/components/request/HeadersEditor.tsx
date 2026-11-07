import React from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { KeyValueItem } from '../../types';
import { useRequestStore } from '../../stores/requestStore';

const commonHeaderPresets = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Accept', value: 'application/json' },
  { key: 'Authorization', value: 'Bearer {{auth_token}}' },
  { key: 'Cache-Control', value: 'no-cache' },
  { key: 'X-API-Key', value: '{{api_key}}' },
];

export const HeadersEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const handleUpdate = (id: string, updates: Partial<KeyValueItem>) => {
    const updated = request.headers.map((item) => (item.id === id ? { ...item, ...updates } : item));
    updateActiveRequest({ headers: updated });
  };

  const handleAdd = (key = '', value = '') => {
    const newItem: KeyValueItem = {
      id: 'h-' + Date.now() + Math.random().toString(36).substring(2, 5),
      key,
      value,
      description: '',
      enabled: true,
    };
    updateActiveRequest({ headers: [...request.headers, newItem] });
  };

  const handleDelete = (id: string) => {
    const remaining = request.headers.filter((item) => item.id !== id);
    updateActiveRequest({ headers: remaining });
  };

  return (
    <div className="p-3 space-y-3 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Request Headers</span>
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Presets:</span>
            {commonHeaderPresets.slice(0, 3).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleAdd(p.key, p.value)}
                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 font-mono transition-colors cursor-pointer"
              >
                +{p.key}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleAdd()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Header</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="w-10 px-3 py-2 text-center">Active</th>
              <th className="px-3 py-2 w-1/3">Key</th>
              <th className="px-3 py-2 w-1/3">Value</th>
              <th className="px-3 py-2">Description</th>
              <th className="w-10 px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
            {request.headers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                  No custom headers added yet. Click &ldquo;Add Header&rdquo; to add one.
                </td>
              </tr>
            ) : (
              request.headers.map((header) => (
                <tr key={header.id} className="hover:bg-slate-800/20 group">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) => handleUpdate(header.id, { enabled: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => handleUpdate(header.id, { key: e.target.value })}
                      placeholder="Header Name"
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-200 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => handleUpdate(header.id, { value: e.target.value })}
                      placeholder="Header Value"
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-cyan-300 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-sans">
                    <input
                      type="text"
                      value={header.description || ''}
                      onChange={(e) => handleUpdate(header.id, { description: e.target.value })}
                      placeholder="Description note"
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-400 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(header.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
