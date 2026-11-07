import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Layers, Check, ExternalLink } from 'lucide-react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useAppStore } from '../../stores/appStore';
import { VariablesEditor } from './VariablesEditor';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface EnvironmentManagerProps {
  isSidebarView?: boolean;
}

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({ isSidebarView = false }) => {
  const {
    environments,
    activeEnvironmentId,
    setActiveEnvironmentId,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
  } = useEnvironmentStore();

  const { setEnvironmentModalOpen } = useAppStore();

  const [selectedEnvId, setSelectedEnvId] = useState<string>(
    activeEnvironmentId || environments[0]?.id || ''
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [newEnvInput, setNewEnvInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: '',
  });

  const selectedEnv = environments.find((e) => e.id === selectedEnvId) || environments[0];

  const handleStartRename = (id: string, name: string) => {
    setSelectedEnvId(id);
    setEditedName(name);
    setIsEditingName(true);
  };

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedName.trim() && selectedEnv) {
      updateEnvironment(selectedEnv.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEnvInput.trim()) {
      const id = addEnvironment(newEnvInput.trim());
      setSelectedEnvId(id);
      setNewEnvInput('');
      setIsCreating(false);
    }
  };

  if (isSidebarView) {
    return (
      <div className="flex flex-col h-full select-none">
        <div className="p-3 border-b border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Environments ({environments.length})
            </span>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreate} className="flex gap-1.5 pt-1">
              <input
                type="text"
                autoFocus
                value={newEnvInput}
                onChange={(e) => setNewEnvInput(e.target.value)}
                placeholder="Environment name..."
                className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-cyan-500 text-slate-200 focus:outline-none"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-cyan-600 text-white text-xs rounded hover:bg-cyan-500 cursor-pointer"
              >
                Add
              </button>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {environments.map((env) => {
            const isActive = env.id === activeEnvironmentId;
            return (
              <div
                key={env.id}
                onClick={() => setActiveEnvironmentId(env.id)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                    : 'text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-xs font-medium truncate">{env.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {env.variables.length} vars
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setEnvironmentModalOpen(true)}
            className="w-full py-1.5 text-xs text-center rounded-lg bg-slate-900/60 hover:bg-slate-800 text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
          >
            Manage Variables Table →
          </button>
        </div>
      </div>
    );
  }

  // Full View (used in modal or full page)
  return (
    <div className="space-y-5">
      {/* Selector pills & creation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          {environments.map((env) => {
            const isSelected = env.id === (selectedEnv?.id ?? '');
            const isActive = env.id === activeEnvironmentId;
            return (
              <div
                key={env.id}
                onClick={() => setSelectedEnvId(env.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <span>{env.name}</span>
                {isActive && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {selectedEnv && selectedEnv.id !== activeEnvironmentId && (
            <button
              type="button"
              onClick={() => setActiveEnvironmentId(selectedEnv.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
            >
              Set as Active
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const name = prompt('Enter new environment name:');
              if (name && name.trim()) {
                const id = addEnvironment(name);
                setSelectedEnvId(id);
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Environment</span>
          </button>
        </div>
      </div>

      {selectedEnv && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {isEditingName ? (
              <form onSubmit={handleSaveRename} className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="px-2.5 py-1 text-sm rounded bg-slate-900 border border-cyan-500 text-slate-100 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-500"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="text-xs text-slate-400"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-200">{selectedEnv.name}</h4>
                <button
                  type="button"
                  onClick={() => handleStartRename(selectedEnv.id, selectedEnv.name)}
                  className="p-1 rounded text-slate-500 hover:text-slate-300"
                  title="Rename environment"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {environments.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setDeleteModal({
                    isOpen: true,
                    id: selectedEnv.id,
                    name: selectedEnv.name,
                  })
                }
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Environment</span>
              </button>
            )}
          </div>

          <VariablesEditor environment={selectedEnv} />
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: '', name: '' })}
        onConfirm={() => deleteEnvironment(deleteModal.id)}
        title="Delete Environment"
        message={`Are you sure you want to delete environment "${deleteModal.name}" and all its variables?`}
      />
    </div>
  );
};
