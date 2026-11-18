import React, { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { AssertionCategory, AssertionOperator, AssertionRule } from '../../types';

const OPERATORS_BY_CATEGORY: Record<AssertionCategory, { value: AssertionOperator; label: string; needsTarget?: boolean; needsValue?: boolean; needsMax?: boolean }[]> = {
  status: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'notEquals', label: 'Not Equals', needsValue: true },
    { value: 'between', label: 'Between', needsValue: true, needsMax: true },
    { value: 'is2xx', label: 'Is 2xx (Success)' },
    { value: 'is4xx', label: 'Is 4xx (Client Error)' },
    { value: 'is5xx', label: 'Is 5xx (Server Error)' },
  ],
  responseTime: [
    { value: 'lessThan', label: 'Less Than (ms)', needsValue: true },
    { value: 'greaterThan', label: 'Greater Than (ms)', needsValue: true },
    { value: 'between', label: 'Between (ms)', needsValue: true, needsMax: true },
  ],
  body: [
    { value: 'exists', label: 'Property Exists', needsTarget: true },
    { value: 'notExists', label: 'Property Not Exists', needsTarget: true },
    { value: 'equals', label: 'Property Equals', needsTarget: true, needsValue: true },
    { value: 'notEquals', label: 'Property Not Equals', needsTarget: true, needsValue: true },
    { value: 'contains', label: 'Contains Text', needsTarget: true, needsValue: true },
    { value: 'notEmpty', label: 'Not Empty', needsTarget: true },
    { value: 'arrayContains', label: 'Array Contains', needsTarget: true, needsValue: true },
    { value: 'arrayLength', label: 'Array Length', needsTarget: true, needsValue: true },
    { value: 'isType', label: 'Value Type', needsTarget: true, needsValue: true },
    { value: 'matchesRegex', label: 'Matches Regex', needsTarget: true, needsValue: true },
  ],
  headers: [
    { value: 'exists', label: 'Header Exists', needsTarget: true },
    { value: 'notExists', label: 'Header Not Exists', needsTarget: true },
    { value: 'equals', label: 'Header Equals', needsTarget: true, needsValue: true },
    { value: 'contains', label: 'Header Contains', needsTarget: true, needsValue: true },
  ],
  contentType: [
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'exists', label: 'Is Present' },
  ],
};

interface AssertionEditorProps {
  initialRule?: AssertionRule;
  onSave: (rule: AssertionRule) => void;
  onCancel?: () => void;
}

export const AssertionEditor: React.FC<AssertionEditorProps> = ({
  initialRule,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialRule?.name || '');
  const [group, setGroup] = useState(initialRule?.group || '');
  const [category, setCategory] = useState<AssertionCategory>(initialRule?.category || 'status');
  const [operator, setOperator] = useState<AssertionOperator>(initialRule?.operator || 'equals');
  const [target, setTarget] = useState(initialRule?.target || '');
  const [expectedValue, setExpectedValue] = useState(initialRule?.expectedValue || '200');
  const [expectedValueMax, setExpectedValueMax] = useState(initialRule?.expectedValueMax || '');

  const availableOps = OPERATORS_BY_CATEGORY[category];
  const currentOpMeta = availableOps.find((o) => o.value === operator) || availableOps[0];

  const handleCategoryChange = (nextCat: AssertionCategory) => {
    setCategory(nextCat);
    const firstOp = OPERATORS_BY_CATEGORY[nextCat][0];
    setOperator(firstOp.value);
    if (nextCat === 'status') {
      setTarget('');
      setExpectedValue('200');
    } else if (nextCat === 'responseTime') {
      setTarget('');
      setExpectedValue('500');
    } else if (nextCat === 'contentType') {
      setTarget('');
      setExpectedValue('application/json');
    } else if (nextCat === 'headers') {
      setTarget('content-type');
      setExpectedValue('');
    } else {
      setTarget('data.id');
      setExpectedValue('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const autoName =
      name.trim() ||
      `${category} ${currentOpMeta.label}${target ? ` (${target})` : ''}${
        currentOpMeta.needsValue && expectedValue ? `: ${expectedValue}` : ''
      }`;

    onSave({
      id: initialRule?.id || `asrt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: autoName,
      group: group.trim() || undefined,
      enabled: initialRule?.enabled ?? true,
      order: initialRule?.order ?? 999,
      category,
      operator: currentOpMeta.value,
      target: currentOpMeta.needsTarget ? target.trim() : undefined,
      expectedValue: currentOpMeta.needsValue ? expectedValue : undefined,
      expectedValueMax: currentOpMeta.needsMax ? expectedValueMax : undefined,
    });

    if (!initialRule) {
      setName('');
      if (category === 'body') setExpectedValue('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/50 dark:bg-slate-900/50 light:bg-slate-50 space-y-2.5 text-xs"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as AssertionCategory)}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
          >
            <option value="status">Status Code</option>
            <option value="responseTime">Response Time</option>
            <option value="body">Response Body</option>
            <option value="headers">Response Headers</option>
            <option value="contentType">Content Type</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Operator</label>
          <select
            value={currentOpMeta.value}
            onChange={(e) => setOperator(e.target.value as AssertionOperator)}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
          >
            {availableOps.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Group (optional)</label>
          <input
            type="text"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="e.g., SLA, Contract"
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {currentOpMeta.needsTarget && (
          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">
              {category === 'headers' ? 'Header Name' : 'JSON Path / Target (blank = raw)'}
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={category === 'headers' ? 'Content-Type' : 'data.items[0].id'}
              className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 font-mono text-xs"
            />
          </div>
        )}

        {currentOpMeta.needsValue && (
          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">
              {operator === 'isType'
                ? 'Type (string|number|boolean|array|object)'
                : currentOpMeta.needsMax
                ? 'Min Value'
                : 'Expected Value'}
            </label>
            <input
              type="text"
              value={expectedValue}
              onChange={(e) => setExpectedValue(e.target.value)}
              placeholder={category === 'status' ? '200' : 'expected value'}
              className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 font-mono text-xs"
            />
          </div>
        )}

        {currentOpMeta.needsMax && (
          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Max Value</label>
            <input
              type="text"
              value={expectedValueMax}
              onChange={(e) => setExpectedValueMax(e.target.value)}
              placeholder="299"
              className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 font-mono text-xs"
            />
          </div>
        )}

        <div className="sm:col-span-1">
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Label (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Auto-generated if empty"
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        )}
        <button
          type="submit"
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
        >
          {initialRule ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{initialRule ? 'Update Assertion' : 'Add Assertion'}</span>
        </button>
      </div>
    </form>
  );
};
