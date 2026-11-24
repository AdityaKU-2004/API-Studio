import React, { useMemo, useState } from 'react';
import {
  GitCompare,
  Plus,
  Copy,
  Archive,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Info,
  Download,
} from 'lucide-react';
import { useSpecStore } from '../../stores/specStore';

export const ApiVersionsView: React.FC = () => {
  const {
    specs,
    versions,
    activeSpecId,
    lastDiff,
    selectSpec,
    createVersionSnapshot,
    duplicateVersion,
    renameVersion,
    setActiveVersion,
    toggleArchiveVersion,
    compareVersions,
  } = useSpecStore();

  const activeSpec = specs.find((s) => s.id === activeSpecId) || null;
  const specVersions = useMemo(
    () => versions.filter((v) => v.specId === activeSpecId),
    [versions, activeSpecId]
  );

  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [baseVerId, setBaseVerId] = useState<string>('');
  const [targetVerId, setTargetVerId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const handleCreateSnapshot = async () => {
    if (!activeSpec) return;
    const label = newVersionLabel.trim() || `1.${specVersions.length}.0`;
    await createVersionSnapshot(activeSpec.id, label, newVersionDesc.trim());
    setNewVersionLabel('');
    setNewVersionDesc('');
  };

  const handleRunComparison = () => {
    const b = baseVerId || specVersions[1]?.id || specVersions[0]?.id;
    const t = targetVerId || specVersions[0]?.id;
    if (b && t) {
      compareVersions(b, t);
    }
  };

  const handleExportVersion = (content: string, label: string, format: 'yaml' | 'json') => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeSpec?.name || 'api').toLowerCase().replace(/\s+/g, '-')}-${label}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d111a] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-[#111622] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <GitCompare className="w-4 h-4 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">
              API Version Management & Breaking Change Detector
            </h1>
            <p className="text-[11px] text-slate-400">
              Snapshot versions, switch active specs, and compare structural breaking changes.
            </p>
          </div>
        </div>

        <select
          value={activeSpecId || ''}
          onChange={(e) => selectSpec(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
        >
          {specs.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Versions List & Snapshot Creation */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200">Create New Version Snapshot</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                placeholder="e.g. 2.0.0"
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
              <input
                type="text"
                value={newVersionDesc}
                onChange={(e) => setNewVersionDesc(e.target.value)}
                placeholder="Release notes..."
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>
            <button
              type="button"
              disabled={!activeSpec}
              onClick={handleCreateSnapshot}
              className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Snapshot Current Specification</span>
            </button>
          </div>

          <div className="space-y-2">
            {specVersions.map((ver) => (
              <div
                key={ver.id}
                className={`p-3.5 rounded-xl border space-y-2 ${
                  ver.isActive
                    ? 'bg-blue-950/20 border-cyan-500/40'
                    : 'bg-slate-900/60 border-slate-800'
                } ${ver.isArchived ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {editingId === ver.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className="w-24 px-2 py-0.5 rounded bg-slate-950 border border-cyan-500 text-xs"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await renameVersion(ver.id, renameDraft);
                            setEditingId(null);
                          }}
                          className="text-[11px] text-emerald-400 cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span
                        onDoubleClick={() => {
                          setEditingId(ver.id);
                          setRenameDraft(ver.versionLabel);
                        }}
                        title="Double click to rename"
                        className="text-xs font-bold font-mono text-slate-100 cursor-pointer"
                      >
                        v{ver.versionLabel}
                      </span>
                    )}
                    {ver.isActive && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                        Active
                      </span>
                    )}
                    {ver.isArchived && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                        Archived
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {new Date(ver.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {ver.description && <p className="text-[11px] text-slate-400">{ver.description}</p>}

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {!ver.isActive && activeSpec && (
                    <button
                      type="button"
                      onClick={() => setActiveVersion(activeSpec.id, ver.id)}
                      className="px-2 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-[11px] text-cyan-300 cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Set Active</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => duplicateVersion(ver.id, `${ver.versionLabel}-next`)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Duplicate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleArchiveVersion(ver.id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer flex items-center gap-1"
                  >
                    <Archive className="w-3 h-3" />
                    <span>{ver.isArchived ? 'Unarchive' : 'Archive'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportVersion(ver.content, ver.versionLabel, ver.format)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Version Diff & Breaking Change Detector */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200">Compare Spec Versions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Base Version</label>
                <select
                  value={baseVerId || specVersions[1]?.id || specVersions[0]?.id || ''}
                  onChange={(e) => setBaseVerId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  {specVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Target Version</label>
                <select
                  value={targetVerId || specVersions[0]?.id || ''}
                  onChange={(e) => setTargetVerId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  {specVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionLabel}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={specVersions.length === 0}
                onClick={handleRunComparison}
                className="py-1.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
              >
                Detect Breaking Changes
              </button>
            </div>
          </div>

          {lastDiff && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="text-xs font-semibold">
                  Diff: <span className="font-mono text-slate-300">v{lastDiff.baseLabel}</span> →{' '}
                  <span className="font-mono text-cyan-300">v{lastDiff.targetLabel}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-red-400 font-semibold">
                    {lastDiff.summary.breaking} Breaking
                  </span>
                  <span className="text-amber-400 font-semibold">
                    {lastDiff.summary.potentiallyBreaking} Potentially Breaking
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    {lastDiff.summary.nonBreaking} Non-Breaking
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
                {lastDiff.disclaimer}
              </div>

              {lastDiff.changes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No structural API changes detected between these two versions.
                </div>
              ) : (
                <div className="space-y-2">
                  {lastDiff.changes.map((chg) => (
                    <div
                      key={chg.id}
                      className={`p-3 rounded-lg border text-xs space-y-1 ${
                        chg.severity === 'breaking'
                          ? 'bg-red-950/20 border-red-500/30'
                          : chg.severity === 'potentially-breaking'
                            ? 'bg-amber-950/20 border-amber-500/30'
                            : 'bg-emerald-950/20 border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-semibold uppercase text-[10px] flex items-center gap-1 ${
                            chg.severity === 'breaking'
                              ? 'text-red-400'
                              : chg.severity === 'potentially-breaking'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {chg.severity === 'breaking' ? (
                            <AlertOctagon className="w-3.5 h-3.5" />
                          ) : chg.severity === 'potentially-breaking' ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <Info className="w-3.5 h-3.5" />
                          )}
                          {chg.severity}
                        </span>
                        <code className="font-mono text-[11px] text-slate-300">
                          {chg.method ? `${chg.method} ` : ''}
                          {chg.path}
                        </code>
                      </div>
                      <p className="text-slate-200">{chg.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
