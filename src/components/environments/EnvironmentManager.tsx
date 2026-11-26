import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Layers,
  Check,
  GitCompare,
  ShieldCheck,
  Download,
  Upload,
} from 'lucide-react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useVariableStore } from '../../stores/variableStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useAppStore } from '../../stores/appStore';
import { VariablesEditor } from './VariablesEditor';
import { ConfirmationModal } from '../common/ConfirmationModal';
import {
  compareEnvironments,
  exportEnvironmentAsSafeTemplate,
  parseEnvironmentTemplatePreview,
  validateEnvironmentConfiguration,
} from '../../services/environments/envValidationService';
import {
  CollectionItem,
  EnvironmentProfileType,
  EnvironmentTemplateFile,
  EnvironmentValidationResult,
} from '../../types';
import { db } from '../../database/database';

interface EnvironmentManagerProps {
  isSidebarView?: boolean;
}

function extractRequestVariables(items: CollectionItem[]): string[] {
  const vars = new Set<string>();
  const walk = (nodes: CollectionItem[]) => {
    for (const node of nodes) {
      if (node.type === 'request' && node.request) {
        const text = `${node.request.url}\n${node.request.rawBody || ''}`;
        for (const m of text.matchAll(/\{\{([A-Za-z0-9_.-]+)\}\}/g)) {
          vars.add(m[1]);
        }
      }
      if (node.children) walk(node.children);
    }
  };
  walk(items);
  return Array.from(vars);
}

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({ isSidebarView = false }) => {
  const {
    environments,
    activeEnvironmentId,
    setActiveEnvironmentId,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
    addVariable,
  } = useEnvironmentStore();
  const { globalVariables } = useVariableStore();
  const { collections } = useCollectionStore();
  const { setEnvironmentModalOpen } = useAppStore();

  const [selectedEnvId, setSelectedEnvId] = useState<string>(
    activeEnvironmentId || environments[0]?.id || ''
  );
  const [subTab, setSubTab] = useState<'variables' | 'compare' | 'validate' | 'templates'>(
    'variables'
  );
  const [compareTargetId, setCompareTargetId] = useState<string>(
    environments[1]?.id || environments[0]?.id || ''
  );
  const [validationReport, setValidationReport] = useState<EnvironmentValidationResult | null>(
    null
  );
  const [importPreview, setImportPreview] = useState<{
    template?: EnvironmentTemplateFile;
    error?: string;
  } | null>(null);

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
  const compareRightEnv = environments.find((e) => e.id === compareTargetId) || environments[0];
  const diffEntries = useMemo(() => {
    if (!selectedEnv || !compareRightEnv) return [];
    return compareEnvironments(selectedEnv, compareRightEnv);
  }, [selectedEnv, compareRightEnv]);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEnvInput.trim()) {
      const id = await addEnvironment(newEnvInput.trim());
      setSelectedEnvId(id);
      setNewEnvInput('');
      setIsCreating(false);
    }
  };

  const handleRunValidation = async () => {
    if (!selectedEnv) return;
    const refs = extractRequestVariables(collections);
    const result = validateEnvironmentConfiguration({
      environment: selectedEnv,
      globalVariables,
      referencedVariablesInRequests: refs,
    });
    setValidationReport(result);
    await db.environmentValidationResults.put(result).catch(() => {});
  };

  const handleExportTemplate = () => {
    if (!selectedEnv) return;
    const tpl = exportEnvironmentAsSafeTemplate(selectedEnv);
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEnv.name.toLowerCase().replace(/\s+/g, '-')}-template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTemplateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const parsed = parseEnvironmentTemplatePreview(raw);
    setImportPreview({ template: parsed.template, error: parsed.error });
  };

  const handleConfirmTemplateImport = async () => {
    if (!importPreview?.template) return;
    const tpl = importPreview.template;
    const envId = await addEnvironment(tpl.name.replace(/\s+Template$/, ''), tpl.description);
    await updateEnvironment(envId, { profileType: tpl.profileType });
    for (const v of tpl.variables) {
      await addVariable(envId, {
        key: v.key,
        initialValue: v.initialValue,
        currentValue: v.initialValue,
        description: v.description,
        isSecret: v.isSecret,
        enabled: v.enabled,
      });
    }
    setSelectedEnvId(envId);
    setImportPreview(null);
    setSubTab('variables');
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
            Manage, Compare &amp; Validate →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selector & creation */}
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
            onClick={() => setIsCreating((c) => !c)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Environment</span>
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={newEnvInput}
            onChange={(e) => setNewEnvInput(e.target.value)}
            placeholder="Environment name (e.g., Staging)..."
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-cyan-500 text-slate-100"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white cursor-pointer"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="px-2 py-1.5 text-xs text-slate-400 cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs w-fit">
        {(
          [
            ['variables', 'Variables & Profile'],
            ['compare', 'Compare Environments'],
            ['validate', 'Config Validator'],
            ['templates', 'Safe Templates'],
          ] as const
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setSubTab(tabKey)}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
              subTab === tabKey ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selectedEnv && subTab === 'variables' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-slate-200">{selectedEnv.name}</h4>
                <button
                  type="button"
                  onClick={() => handleStartRename(selectedEnv.id, selectedEnv.name)}
                  className="p-1 rounded text-slate-500 hover:text-slate-300"
                  title="Rename environment"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <select
                  value={selectedEnv.profileType || 'custom'}
                  onChange={(e) =>
                    void updateEnvironment(selectedEnv.id, {
                      profileType: e.target.value as EnvironmentProfileType,
                    })
                  }
                  className="px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                >
                  <option value="local">Local</option>
                  <option value="development">Development</option>
                  <option value="testing">Testing</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                  <option value="custom">Custom</option>
                </select>
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

      {selectedEnv && subTab === 'compare' && (
        <div className="space-y-3 text-xs">
          <div className="flex items-center gap-3">
            <GitCompare className="w-4 h-4 text-cyan-400" />
            <span>Compare {selectedEnv.name} against:</span>
            <select
              value={compareRightEnv?.id || ''}
              onChange={(e) => setCompareTargetId(e.target.value)}
              className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left font-mono">
              <thead className="bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="p-2">Key</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">{selectedEnv.name}</th>
                  <th className="p-2">{compareRightEnv?.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {diffEntries.map((d) => (
                  <tr key={d.key}>
                    <td className="p-2 font-semibold">{d.key}</td>
                    <td
                      className={`p-2 uppercase ${
                        d.changeType === 'added'
                          ? 'text-emerald-400'
                          : d.changeType === 'removed'
                          ? 'text-red-400'
                          : d.changeType === 'changed'
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {d.changeType}
                    </td>
                    <td className="p-2 text-slate-300">{d.leftValueMasked ?? '—'}</td>
                    <td className="p-2 text-slate-300">{d.rightValueMasked ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedEnv && subTab === 'validate' && (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span>Validate URLs, numeric config, duplicates, and unresolved references:</span>
            <button
              type="button"
              onClick={() => void handleRunValidation()}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Run Config Check</span>
            </button>
          </div>
          {validationReport && (
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2">
              <div className={validationReport.valid ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                {validationReport.valid
                  ? `Configuration passed (${validationReport.issues.length} advisory notes)`
                  : `Configuration has validation errors`}
              </div>
              {validationReport.issues.map((iss) => (
                <div key={iss.id} className="p-2 rounded border border-slate-800 bg-slate-950/60">
                  <span className="uppercase font-bold mr-2">{iss.severity}</span>
                  <span>{iss.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedEnv && subTab === 'templates' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportTemplate}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Secret-Free Template JSON</span>
            </button>
            <label className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Template Preview</span>
              <input
                type="file"
                accept=".json"
                onChange={(e) => void handleImportTemplateFile(e)}
                className="hidden"
              />
            </label>
          </div>

          {importPreview?.error && (
            <div className="p-2.5 rounded border border-red-500/40 text-red-400">
              {importPreview.error}
            </div>
          )}

          {importPreview?.template && (
            <div className="p-3 rounded-lg border border-cyan-500/40 bg-slate-900/70 space-y-2">
              <div className="font-semibold">
                Preview: {importPreview.template.name} ({importPreview.template.profileType}) ·{' '}
                {importPreview.template.variables.length} variables (secrets stripped)
              </div>
              <button
                type="button"
                onClick={() => void handleConfirmTemplateImport()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium cursor-pointer"
              >
                Confirm &amp; Create Environment
              </button>
            </div>
          )}
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
