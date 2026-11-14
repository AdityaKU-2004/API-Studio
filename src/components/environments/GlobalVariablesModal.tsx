import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Globe,
  Search,
  Shield,
  Layers,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useVariableStore } from '../../stores/variableStore';
import { GlobalVariable } from '../../types';

export const GlobalVariablesModal: React.FC = () => {
  const { isGlobalVariablesModalOpen, setGlobalVariablesModalOpen } = useAppStore();
  const { globalVariables, addVariable, updateVariable, deleteVariable } = useVariableStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isGlobalVariablesModalOpen) return null;

  const handleAddNew = async () => {
    await addVariable('new_var', '', '', false, '');
  };

  const handleCopyTag = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const filteredVariables = globalVariables.filter(
    (v) =>
      v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl bg-[#121620] border border-blue-500/25 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Global Variables</h2>
              <p className="text-[11px] text-slate-400">
                Variables accessible across all collections and environments (lowest precedence: Request &gt; Env &gt; Folder &gt; Col &gt; Global).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGlobalVariablesModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search global variables..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <button
            type="button"
            onClick={handleAddNew}
            className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variable</span>
          </button>
        </div>

        {/* Variables Table */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {filteredVariables.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800">
              No global variables configured.
            </div>
          ) : (
            filteredVariables.map((v) => {
              const isRevealed = !!revealedSecrets[v.id];
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={v.enabled}
                    onChange={(e) => updateVariable(v.id, { enabled: e.target.checked })}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />

                  {/* Variable Key */}
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => updateVariable(v.id, { key: e.target.value })}
                    placeholder="variable_name"
                    className="w-1/3 px-2 py-1 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                  />

                  {/* Variable Value */}
                  <div className="relative flex-1">
                    <input
                      type={v.isSecret && !isRevealed ? 'password' : 'text'}
                      value={v.currentValue ?? v.initialValue ?? ''}
                      onChange={(e) =>
                        updateVariable(v.id, {
                          currentValue: e.target.value,
                          initialValue: v.initialValue || e.target.value,
                        })
                      }
                      placeholder="Value"
                      className="w-full pl-2 pr-7 py-1 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                    />
                    {v.isSecret && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedSecrets((prev) => ({ ...prev, [v.id]: !prev[v.id] }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Secret toggle badge */}
                  <button
                    type="button"
                    onClick={() => updateVariable(v.id, { isSecret: !v.isSecret })}
                    title={v.isSecret ? 'Variable is masked as a secret' : 'Mark variable as secret'}
                    className={`px-2 py-1 text-[10px] rounded border font-mono transition-colors ${
                      v.isSecret
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {v.isSecret ? 'SECRET' : 'PLAIN'}
                  </button>

                  {/* Copy tag button */}
                  <button
                    type="button"
                    onClick={() => handleCopyTag(v.key)}
                    title={`Copy {{${v.key}}}`}
                    className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    {copiedKey === v.key ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => deleteVariable(v.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/80 bg-slate-900/50">
          <span className="text-[11px] text-slate-500 font-mono">
            {globalVariables.length} global variables configured
          </span>
          <button
            type="button"
            onClick={() => setGlobalVariablesModalOpen(false)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
