import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { KeyValueItem } from '../../types';
import { useRequestStore } from '../../stores/requestStore';

export const ParamsEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const handleUpdate = (id: string, updates: Partial<KeyValueItem>) => {
    const updated = request.params.map((item) => (item.id === id ? { ...item, ...updates } : item));
    updateActiveRequest({ params: updated });
  };

  const handleAdd = () => {
    const newItem: KeyValueItem = {
      id: 'p-' + Date.now(),
      key: '',
      value: '',
      description: '',
      enabled: true,
    };
    updateActiveRequest({ params: [...request.params, newItem] });
  };

  const handleDelete = (id: string) => {
    const remaining = request.params.filter((item) => item.id !== id);
    updateActiveRequest({ params: remaining });
  };

  return (
    <div className="p-3 space-y-3 select-none">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">Query Parameters</span>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Parameter</span>
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
            {request.params.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                  No query parameters added yet. Click &ldquo;Add Parameter&rdquo; to add one.
                </td>
              </tr>
            ) : (
              request.params.map((param) => (
                <tr key={param.id} className="hover:bg-slate-800/20 group">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={param.enabled}
                      onChange={(e) => handleUpdate(param.id, { enabled: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={param.key}
                      onChange={(e) => handleUpdate(param.id, { key: e.target.value })}
                      placeholder="key"
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-200 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => handleUpdate(param.id, { value: e.target.value })}
                      placeholder="value"
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-cyan-300 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-sans">
                    <input
                      type="text"
                      value={param.description || ''}
                      onChange={(e) => handleUpdate(param.id, { description: e.target.value })}
                      placeholder="Description"
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-400 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(param.id)}
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
