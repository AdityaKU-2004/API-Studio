import React, { useState, useMemo } from 'react';
import {
  FileCode2,
  Plus,
  Trash2,
  ArrowRight,
  Search,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { ScriptStage, ScriptTemplate } from '../../types';
import { useScriptingStore } from '../../stores/scriptingStore';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import { useAppStore } from '../../stores/appStore';

interface ScriptTemplatesProps {
  onInsertCode?: (code: string, stage: ScriptStage) => void;
}

export const ScriptTemplates: React.FC<ScriptTemplatesProps> = ({ onInsertCode }) => {
  const { templates, saveTemplate, deleteTemplate } = useScriptingStore();
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const { setActiveRequestTab } = useUiStore();
  const { setActiveView } = useAppStore();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | ScriptStage>('all');
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id || '');
  const [isCreating, setIsCreating] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftStage, setDraftStage] = useState<ScriptStage>('post-response');
  const [draftCategory, setDraftCategory] = useState<ScriptTemplate['category']>('testing');
  const [draftCode, setDraftCode] = useState(
    'pm.test("Custom check", function () {\n  pm.response.to.have.status(200);\n});'
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [insertedToast, setInsertedToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (stageFilter !== 'all' && t.stage !== stageFilter) return false;
      if (
        search.trim() &&
        !t.name.toLowerCase().includes(search.toLowerCase()) &&
        !t.description.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [templates, stageFilter, search]);

  const selected = templates.find((t) => t.id === selectedId) || filtered[0] || null;

  const handleInsertIntoActiveRequest = (tpl: ScriptTemplate) => {
    if (onInsertCode) {
      onInsertCode(tpl.code, tpl.stage);
      return;
    }

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) return;
    const req = activeTab.request;

    if (tpl.stage === 'pre-request') {
      const existing = req.scripts?.preRequest?.script ?? req.preRequestScript ?? '';
      const next = (existing.trim() ? `${existing}\n\n` : '') + tpl.code;
      updateActiveRequest({
        preRequestScript: next,
        scripts: {
          ...(req.scripts || { postResponse: { script: req.testScript || '', enabled: true } }),
          preRequest: { script: next, enabled: true },
        },
      });
    } else {
      const existing = req.scripts?.postResponse?.script ?? req.testScript ?? '';
      const next = (existing.trim() ? `${existing}\n\n` : '') + tpl.code;
      updateActiveRequest({
        testScript: next,
        scripts: {
          ...(req.scripts || { preRequest: { script: req.preRequestScript || '', enabled: true } }),
          postResponse: { script: next, enabled: true },
        },
      });
    }

    setInsertedToast(`Inserted "${tpl.name}" into active request`);
    setTimeout(() => setInsertedToast(null), 2500);
  };

  const handleStartNew = () => {
    setEditingId(null);
    setDraftName('');
    setDraftDesc('');
    setDraftStage('post-response');
    setDraftCategory('testing');
    setDraftCode('pm.test("Custom assertion", function () {\n  pm.response.to.have.status(200);\n});');
    setIsCreating(true);
  };

  const handleEditTemplate = (tpl: ScriptTemplate) => {
    setEditingId(tpl.id);
    setDraftName(tpl.name);
    setDraftDesc(tpl.description);
    setDraftStage(tpl.stage);
    setDraftCategory(tpl.category);
    setDraftCode(tpl.code);
    setIsCreating(true);
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim() || !draftCode.trim()) return;
    const id = editingId || `tpl-custom-${Date.now()}`;
    await saveTemplate({
      id,
      name: draftName.trim(),
      description: draftDesc.trim() || 'Custom reusable script template',
      category: draftCategory,
      stage: draftStage,
      code: draftCode,
      isBuiltIn: false,
    });
    setSelectedId(id);
    setIsCreating(false);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#11151e] dark:bg-[#11151e] light:bg-white text-slate-200 dark:text-slate-200 light:text-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <FileCode2 className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100 dark:text-slate-100 light:text-slate-900">
              Script Template Library
            </h1>
            <p className="text-[11px] text-slate-400">
              Built-in QuickJS/pm snippets and custom reusable templates persisted locally
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {insertedToast && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 mr-2">
              <Check className="w-3.5 h-3.5" />
              {insertedToast}
            </span>
          )}
          <button
            type="button"
            onClick={handleStartNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left List */}
        <div className="w-80 border-r border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/70 dark:border-slate-800/70 light:border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter templates..."
                className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-200 text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              {(['all', 'pre-request', 'post-response'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStageFilter(st)}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    stageFilter === st
                      ? 'bg-blue-600/25 text-cyan-300 border border-blue-500/30 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st === 'all' ? 'All' : st === 'pre-request' ? 'Pre-request' : 'Post-response'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.map((tpl) => {
              const isSelected = selected?.id === tpl.id && !isCreating;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedId(tpl.id);
                  }}
                  className={`w-full text-left p-2.5 rounded-md border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/40 text-slate-100'
                      : 'border-transparent hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{tpl.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {tpl.isBuiltIn ? 'built-in' : 'custom'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                    {tpl.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Detail / Editor */}
        <div className="flex-1 overflow-y-auto p-5">
          {isCreating ? (
            <form onSubmit={handleSaveDraft} className="max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {editingId ? 'Edit Custom Template' : 'Create Script Template'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Template Name</label>
                  <input
                    type="text"
                    required
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g., Verify Pagination Meta"
                    className="w-full px-3 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-700 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Stage</label>
                    <select
                      value={draftStage}
                      onChange={(e) => setDraftStage(e.target.value as ScriptStage)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-700 text-xs"
                    >
                      <option value="pre-request">Pre-request</option>
                      <option value="post-response">Post-response</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Category</label>
                    <select
                      value={draftCategory}
                      onChange={(e) =>
                        setDraftCategory(e.target.value as ScriptTemplate['category'])
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-700 text-xs"
                    >
                      <option value="testing">Testing</option>
                      <option value="variables">Variables</option>
                      <option value="validation">Validation</option>
                      <option value="security">Security</option>
                      <option value="pre-request">Pre-request</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="Describe what this snippet validates or prepares"
                  className="w-full px-3 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">JavaScript Code</label>
                <textarea
                  rows={10}
                  required
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value)}
                  className="w-full p-3 rounded bg-[#0c1018] border border-slate-700 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                >
                  Save Template
                </button>
              </div>
            </form>
          ) : selected ? (
            <div className="max-w-3xl space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase">
                    <span>{selected.stage}</span>
                    <span>·</span>
                    <span>{selected.category}</span>
                  </div>
                  <h2 className="text-base font-semibold mt-1">{selected.name}</h2>
                  <p className="text-xs text-slate-400 mt-1">{selected.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!selected.isBuiltIn && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEditTemplate(selected)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-700 text-xs text-slate-300 hover:text-cyan-300 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(selected.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleInsertIntoActiveRequest(selected);
                      setActiveRequestTab('scripts');
                      setActiveView('collections');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
                  >
                    <span>Insert into Request</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#0c1018] overflow-hidden">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                  Preview ({selected.stage}.js)
                </div>
                <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                  {selected.code}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-12 text-center">
              Select a script template or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
