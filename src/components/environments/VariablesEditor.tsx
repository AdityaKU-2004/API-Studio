import React from 'react';
import { Plus, Trash2, Check, Copy } from 'lucide-react';
import { Environment, EnvironmentVariable } from '../../types';
import { useEnvironmentStore } from '../../stores/environmentStore';

interface VariablesEditorProps {
  environment: Environment;
}

export const VariablesEditor: React.FC<VariablesEditorProps> = ({ environment }) => {
  const { addVariable, updateVariable, deleteVariable } = useEnvironmentStore();

  const handleAdd = () => {
    addVariable(environment.id, {
      key: '',
      initialValue: '',
      currentValue: '',
      description: '',
      enabled: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* Variable syntax notice */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300">
        <div>
          <span className="font-semibold text-cyan-400">Variable Syntax: </span>
          <span>Use </span>
          <code className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-cyan-300 border border-slate-700">
            {`{{variable_name}}`}
          </code>
          <span> in URL, Headers, Body, or Auth tokens.</span>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:brightness-110 active:brightness-95 transition-all text-xs cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Variable</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="w-10 px-3 py-2 text-center">Active</th>
              <th className="px-3 py-2 min-w-[140px]">Variable Name</th>
              <th className="px-3 py-2 min-w-[160px]">Initial Value</th>
              <th className="px-3 py-2 min-w-[160px]">Current Value</th>
              <th className="px-3 py-2 min-w-[160px]">Description</th>
              <th className="w-12 px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
            {environment.variables.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                  No variables defined in this environment. Click &ldquo;Add Variable&rdquo; to create one.
                </td>
              </tr>
            ) : (
              environment.variables.map((variable) => (
                <tr key={variable.id} className="hover:bg-slate-800/20 group">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={variable.enabled}
                      onChange={(e) =>
                        updateVariable(environment.id, variable.id, { enabled: e.target.checked })
                      }
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) =>
                        updateVariable(environment.id, variable.id, { key: e.target.value })
                      }
                      placeholder="e.g., base_url"
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-200 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={variable.initialValue}
                      onChange={(e) =>
                        updateVariable(environment.id, variable.id, { initialValue: e.target.value })
                      }
                      placeholder="https://api..."
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-300 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={variable.currentValue}
                      onChange={(e) =>
                        updateVariable(environment.id, variable.id, { currentValue: e.target.value })
                      }
                      placeholder="https://api..."
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-cyan-300 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-sans">
                    <input
                      type="text"
                      value={variable.description}
                      onChange={(e) =>
                        updateVariable(environment.id, variable.id, { description: e.target.value })
                      }
                      placeholder="Description note"
                      className="w-full px-2 py-1 bg-transparent border border-transparent focus:border-cyan-500 rounded text-slate-400 focus:bg-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => deleteVariable(environment.id, variable.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Delete variable"
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
