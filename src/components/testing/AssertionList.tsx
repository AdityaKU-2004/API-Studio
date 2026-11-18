import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  Save,
  FolderOpen,
  ShieldCheck,
} from 'lucide-react';
import { AssertionRule } from '../../types';
import { useRequestStore } from '../../stores/requestStore';
import { useTestingStore } from '../../stores/testingStore';
import { AssertionEditor } from './AssertionEditor';

interface AssertionListProps {
  customRules?: AssertionRule[];
  onChangeRules?: (rules: AssertionRule[]) => void;
}

export const AssertionList: React.FC<AssertionListProps> = ({ customRules, onChangeRules }) => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const { assertionConfigs, saveAssertionConfig } = useTestingStore();

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showPresetBar, setShowPresetBar] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const rules: AssertionRule[] =
    customRules !== undefined ? customRules : request?.assertions || [];

  const commitRules = (nextRules: AssertionRule[]) => {
    const normalized = nextRules.map((r, idx) => ({ ...r, order: idx + 1 }));
    if (onChangeRules) {
      onChangeRules(normalized);
    } else if (request) {
      updateActiveRequest({ assertions: normalized });
    }
  };

  if (!customRules && !request) return null;

  const handleAddRule = (rule: AssertionRule) => {
    commitRules([...rules, { ...rule, order: rules.length + 1 }]);
  };

  const handleUpdateRule = (rule: AssertionRule) => {
    commitRules(rules.map((r) => (r.id === rule.id ? rule : r)));
    setEditingRuleId(null);
  };

  const handleDeleteRule = (id: string) => {
    commitRules(rules.filter((r) => r.id !== id));
  };

  const handleToggleRule = (id: string) => {
    commitRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= rules.length) return;
    const copy = [...rules];
    const tmp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = tmp;
    commitRules(copy);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim() || rules.length === 0) return;
    await saveAssertionConfig({
      id: `acfg-${Date.now()}`,
      name: presetName.trim(),
      rules,
    });
    setPresetName('');
    setShowPresetBar(false);
  };

  const handleApplyPreset = (configId: string) => {
    const found = assertionConfigs.find((c) => c.id === configId);
    if (!found) return;
    const cloned = found.rules.map((r, i) => ({
      ...r,
      id: `asrt-${Date.now()}-${i}`,
    }));
    commitRules([...rules, ...cloned]);
  };

  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
            Automated Assertions ({rules.filter((r) => r.enabled).length}/{rules.length} active)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {assertionConfigs.length > 0 && (
            <div className="flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleApplyPreset(e.target.value);
                }}
                className="px-2 py-1 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-white border border-slate-700/70 dark:border-slate-700/70 light:border-slate-300 text-[11px]"
              >
                <option value="">Load Saved Preset...</option>
                {assertionConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>
                    {cfg.name} ({cfg.rules.length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {rules.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPresetBar((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700/70 dark:border-slate-700/70 light:border-slate-300 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-cyan-300 cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>Save Preset</span>
            </button>
          )}
        </div>
      </div>

      {showPresetBar && (
        <div className="flex items-center gap-2 p-2.5 rounded border border-blue-500/30 bg-blue-950/20">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name (e.g., Standard REST SLA)"
            className="flex-1 px-2.5 py-1 rounded bg-slate-950/70 border border-slate-700 text-xs"
          />
          <button
            type="button"
            onClick={handleSavePreset}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
          >
            Save
          </button>
        </div>
      )}

      {/* Existing rules */}
      <div className="space-y-1.5">
        {rules.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-slate-800 dark:border-slate-800 light:border-slate-300 text-center text-slate-500">
            No assertions configured yet. Add one below to verify status codes, latency, JSON body properties, or headers automatically.
          </div>
        ) : (
          rules.map((rule, idx) =>
            editingRuleId === rule.id ? (
              <AssertionEditor
                key={rule.id}
                initialRule={rule}
                onSave={handleUpdateRule}
                onCancel={() => setEditingRuleId(null)}
              />
            ) : (
              <div
                key={rule.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border transition-colors ${
                  rule.enabled
                    ? 'border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-white'
                    : 'border-slate-800/50 opacity-60 bg-slate-900/20'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggleRule(rule.id)}
                    className="rounded border-slate-700 text-cyan-500 bg-slate-950 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200 dark:text-slate-200 light:text-slate-800 truncate">
                        {rule.name}
                      </span>
                      {rule.group && (
                        <span className="text-[10px] font-mono text-cyan-400">
                          [{rule.group}]
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {rule.category} · {rule.operator}
                      {rule.target ? ` · ${rule.target}` : ''}
                      {rule.expectedValue !== undefined ? ` = ${rule.expectedValue}` : ''}
                      {rule.expectedValueMax ? ` .. ${rule.expectedValueMax}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    title="Move up"
                    className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === rules.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    title="Move down"
                    className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRuleId(rule.id)}
                    title="Edit assertion"
                    className="p-1 text-slate-400 hover:text-cyan-400 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    title="Delete assertion"
                    className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* Add new rule */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
          Add Assertion Rule
        </div>
        <AssertionEditor onSave={handleAddRule} />
      </div>
    </div>
  );
};
