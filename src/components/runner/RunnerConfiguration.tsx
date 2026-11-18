import React, { useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Upload,
  Trash2,
  Folder,
  FileSpreadsheet,
} from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useRunnerStore } from '../../stores/runnerStore';
import { MethodBadge } from '../common/MethodBadge';
import { FailureHandlingMode, IterationDataFormat } from '../../types';

export const RunnerConfiguration: React.FC = () => {
  const { collections } = useCollectionStore();
  const { environments } = useEnvironmentStore();
  const {
    config,
    progress,
    dataParseError,
    loadFromCollection,
    updateConfig,
    toggleRequestSelection,
    moveRequestOrder,
    importIterationData,
    clearIterationData,
  } = useRunnerStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawDataText, setRawDataText] = useState('');
  const [dataFormat, setDataFormat] = useState<IterationDataFormat>('csv');
  const [showDataInput, setShowDataInput] = useState(false);

  const isRunning = progress?.status === 'running' || progress?.status === 'paused';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext: IterationDataFormat = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    setDataFormat(ext);
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setRawDataText(content);
      importIterationData(content, ext);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Extract folders for selected collection
  const selectedCollection = collections.find((c) => c.id === config.collectionId);
  const folderOptions: { id: string; name: string }[] = [];
  if (selectedCollection?.children) {
    const walk = (nodes: typeof selectedCollection.children, prefix = '') => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          const label = prefix ? `${prefix} / ${n.name}` : n.name;
          folderOptions.push({ id: n.id, name: label });
          if (n.children) walk(n.children, label);
        }
      }
    };
    walk(selectedCollection.children);
  }

  return (
    <div className="space-y-4 text-xs">
      {/* Target Collection / Folder / Environment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Collection</label>
          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              disabled={isRunning}
              value={config.collectionId || ''}
              onChange={(e) => {
                if (e.target.value) loadFromCollection(e.target.value);
              }}
              className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
            >
              <option value="">Choose collection...</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Folder Scope</label>
          <select
            disabled={isRunning || !config.collectionId}
            value={config.folderId || ''}
            onChange={(e) => {
              if (config.collectionId) {
                loadFromCollection(config.collectionId, e.target.value || undefined);
              }
            }}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
          >
            <option value="">Entire Collection</option>
            {folderOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Environment</label>
          <select
            disabled={isRunning}
            value={config.environmentId || ''}
            onChange={(e) => updateConfig({ environmentId: e.target.value || null })}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
          >
            <option value="">No Environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Run Settings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Iterations</label>
          <input
            type="number"
            min={1}
            max={500}
            disabled={isRunning}
            value={config.iterations}
            onChange={(e) => updateConfig({ iterations: Math.max(1, Number(e.target.value) || 1) })}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Delay (ms)</label>
          <input
            type="number"
            min={0}
            max={60000}
            step={50}
            disabled={isRunning}
            value={config.delayMs}
            onChange={(e) => updateConfig({ delayMs: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Timeout (ms)</label>
          <input
            type="number"
            min={500}
            max={120000}
            step={500}
            disabled={isRunning}
            value={config.timeoutMs}
            onChange={(e) => updateConfig({ timeoutMs: Math.max(500, Number(e.target.value) || 10000) })}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">On Failure</label>
          <select
            disabled={isRunning}
            value={config.failureMode}
            onChange={(e) => updateConfig({ failureMode: e.target.value as FailureHandlingMode })}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
          >
            <option value="continue">Continue execution</option>
            <option value="stop">Stop on failure</option>
          </select>
        </div>
      </div>

      {/* Iteration Data (CSV / JSON) */}
      <div className="p-3.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold">
              Iteration Data ({config.iterationData.length} row{config.iterationData.length === 1 ? '' : 's'})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={isRunning}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 hover:text-cyan-300 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV / JSON</span>
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setShowDataInput((v) => !v)}
              className="px-2.5 py-1 rounded border border-slate-700 hover:text-cyan-300 cursor-pointer disabled:opacity-50"
            >
              {showDataInput ? 'Hide Paste' : 'Paste Data'}
            </button>
            {config.iterationData.length > 0 && (
              <button
                type="button"
                disabled={isRunning}
                onClick={clearIterationData}
                className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                title="Clear iteration data"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {showDataInput && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={dataFormat}
                onChange={(e) => setDataFormat(e.target.value as IterationDataFormat)}
                className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <span className="text-[11px] text-slate-400">
                Access columns via {'{{column}}'} or pm.iterationData.get(&quot;column&quot;)
              </span>
            </div>
            <textarea
              rows={4}
              value={rawDataText}
              onChange={(e) => setRawDataText(e.target.value)}
              placeholder={
                dataFormat === 'csv'
                  ? 'userId,expectedRole\n1,admin\n2,editor'
                  : '[\n  { "userId": "1", "expectedRole": "admin" }\n]'
              }
              className="w-full p-2.5 rounded bg-[#0c1018] border border-slate-700 font-mono text-xs text-slate-200"
            />
            <button
              type="button"
              onClick={() => importIterationData(rawDataText, dataFormat)}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
            >
              Parse {dataFormat.toUpperCase()} Data
            </button>
          </div>
        )}

        {dataParseError && (
          <div className="text-red-400 text-[11px] font-mono">{dataParseError}</div>
        )}
      </div>

      {/* Request Selection & Execution Order */}
      <div className="rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 overflow-hidden">
        <div className="px-3.5 py-2 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 bg-slate-900/50 dark:bg-slate-900/50 light:bg-slate-50 flex items-center justify-between">
          <span className="font-semibold">
            Execution Queue ({config.requests.filter((r) => r.enabled).length}/{config.requests.length} selected)
          </span>
          <span className="font-mono text-[10px] text-slate-400">Sequential order</span>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 dark:divide-slate-800/60 light:divide-slate-200">
          {config.requests.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Select a collection above to populate the execution queue.
            </div>
          ) : (
            [...config.requests]
              .sort((a, b) => a.order - b.order)
              .map((sel, idx, arr) => (
                <div
                  key={sel.requestId}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2 ${
                    sel.enabled ? '' : 'opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      disabled={isRunning}
                      checked={sel.enabled}
                      onChange={(e) => toggleRequestSelection(sel.requestId, e.target.checked)}
                      className="rounded border-slate-700 text-cyan-500 bg-slate-950 cursor-pointer"
                    />
                    <span className="w-5 font-mono text-[10px] text-slate-500">{idx + 1}.</span>
                    <MethodBadge method={sel.method} size="sm" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{sel.name}</div>
                      <div className="font-mono text-[10px] text-slate-400 truncate">{sel.url}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isRunning || idx === 0}
                      onClick={() => moveRequestOrder(sel.requestId, 'up')}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isRunning || idx === arr.length - 1}
                      onClick={() => moveRequestOrder(sel.requestId, 'down')}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
