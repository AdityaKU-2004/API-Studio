import React, { useState } from 'react';
import {
  GitCompare,
  ArrowLeftRight,
  ShieldAlert,
  ShieldCheck,
  Save,
  Trash2,
  FolderOpen,
  AlertTriangle,
  FileJson,
  AlignLeft,
  ListTree,
} from 'lucide-react';
import { useComparisonStore } from '../../stores/comparisonStore';
import { useHistoryStore } from '../../stores/historyStore';

type DiffTab = 'json' | 'text' | 'headers';

export const ResponseComparisonWorkspace: React.FC = () => {
  const {
    left,
    right,
    maskSensitiveHeaders,
    result,
    savedSessions,
    setLeft,
    setRight,
    loadFromHistory,
    swapSides,
    setMaskSensitiveHeaders,
    saveSession,
    applySavedSession,
    deleteSavedSession,
  } = useComparisonStore();
  const { history } = useHistoryStore();

  const [activeTab, setActiveTab] = useState<DiffTab>('json');
  const [textViewMode, setTextViewMode] = useState<'unified' | 'side-by-side'>('side-by-side');
  const [sessionName, setSessionName] = useState('');
  const [showSavedDrawer, setShowSavedDrawer] = useState(false);
  const [showEditors, setShowEditors] = useState(true);

  const handleSave = async () => {
    await saveSession(sessionName);
    setSessionName('');
  };

  const parseHeadersInput = (raw: string): Record<string, string> => {
    const out: Record<string, string> = {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          out[k] = String(v);
        }
        return out;
      }
    } catch {
      // Fallback line-by-line key: value parsing
    }
    for (const line of raw.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    return out;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0d13] text-slate-200 overflow-hidden select-none">
      {/* Top Bar */}
      <div className="px-5 py-3 border-b border-slate-800/80 bg-[#0d1017] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <GitCompare className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Response Comparison</h1>
            <p className="text-[11px] text-slate-400">
              Inspect structural JSON, line-by-line text, and header differences between two responses
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={maskSensitiveHeaders}
              onChange={(e) => setMaskSensitiveHeaders(e.target.checked)}
              className="accent-cyan-500 cursor-pointer"
            />
            {maskSensitiveHeaders ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Mask Sensitive Headers</span>
          </label>

          <button
            type="button"
            onClick={swapSides}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            <span>Swap A ↔ B</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEditors(!showEditors)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 cursor-pointer transition-colors"
          >
            {showEditors ? 'Hide Inputs' : 'Edit Inputs'}
          </button>

          <div className="flex items-center gap-1">
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Session name..."
              className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 w-36"
            />
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSavedDrawer(!showSavedDrawer)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Saved ({savedSessions.length})</span>
          </button>
        </div>
      </div>

      {/* Saved Sessions Strip */}
      {showSavedDrawer && (
        <div className="px-5 py-2.5 bg-slate-900/70 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          {savedSessions.length === 0 ? (
            <span className="text-xs text-slate-500">No saved comparison sessions yet.</span>
          ) : (
            savedSessions.map((sess) => (
              <div
                key={sess.id}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs shrink-0"
              >
                <button
                  type="button"
                  onClick={() => applySavedSession(sess)}
                  className="text-cyan-300 hover:text-cyan-200 font-medium cursor-pointer"
                >
                  {sess.name}
                </button>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(sess.updatedAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  onClick={() => deleteSavedSession(sess.id)}
                  className="text-slate-500 hover:text-red-400 cursor-pointer"
                  title="Delete session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Security / Comparison Warnings */}
      {result.warnings.length > 0 && (
        <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center gap-3 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div className="space-y-0.5">
            {result.warnings.map((w, idx) => (
              <div key={idx}>{w}</div>
            ))}
          </div>
        </div>
      )}

      {/* Side A / Side B Inputs */}
      {showEditors && (
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-slate-800/80 bg-[#0d1118]">
          {[
            { side: 'left' as const, data: left, setter: setLeft, badge: 'A' },
            { side: 'right' as const, data: right, setter: setRight, badge: 'B' },
          ].map(({ side, data, setter, badge }) => (
            <div
              key={side}
              className={`p-3 space-y-2 ${side === 'left' ? 'lg:border-r border-b lg:border-b-0 border-slate-800/80' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-blue-600/25 border border-blue-500/40 text-cyan-300 text-[11px] font-mono font-bold flex items-center justify-center">
                    {badge}
                  </span>
                  <input
                    type="text"
                    value={data.label}
                    onChange={(e) => setter({ label: e.target.value, sourceType: 'manual' })}
                    className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500/50 w-44"
                  />
                  <input
                    type="number"
                    value={data.status ?? ''}
                    onChange={(e) =>
                      setter({ status: e.target.value ? Number(e.target.value) : undefined })
                    }
                    placeholder="Status"
                    className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 w-20 focus:outline-none focus:border-cyan-500/50"
                    title="HTTP Status Code"
                  />
                  <input
                    type="number"
                    value={data.timeMs ?? ''}
                    onChange={(e) =>
                      setter({ timeMs: e.target.value ? Number(e.target.value) : undefined })
                    }
                    placeholder="ms"
                    className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 w-20 focus:outline-none focus:border-cyan-500/50"
                    title="Response Time (ms)"
                  />
                </div>

                <select
                  value={data.historyId || ''}
                  onChange={(e) => {
                    const item = history.find((h) => h.id === e.target.value);
                    if (item) loadFromHistory(side, item);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 max-w-[220px] focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  <option value="">Load from History...</option>
                  {history.slice(0, 40).map((h) => (
                    <option key={h.id} value={h.id}>
                      [{h.status || 'ERR'}] {h.method} {h.url.slice(0, 42)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <textarea
                  value={data.body}
                  onChange={(e) => setter({ body: e.target.value, sourceType: 'manual' })}
                  placeholder={`Paste Response ${badge} body (JSON or text)...`}
                  spellCheck={false}
                  className="sm:col-span-2 h-28 p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
                />
                <textarea
                  value={JSON.stringify(data.headers, null, 2)}
                  onChange={(e) => setter({ headers: parseHeadersInput(e.target.value) })}
                  placeholder='{"content-type": "application/json"}'
                  spellCheck={false}
                  className="h-28 p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500/50 resize-none select-text"
                  title="Headers JSON or Key: Value lines"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Bar & Diff Subtabs */}
      <div className="px-5 py-2.5 border-b border-slate-800/80 bg-[#0d1017] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'json'
                ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>JSON Diff ({result.jsonDiffs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'text'
                ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Text Diff</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'headers'
                ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>Headers ({result.summary.headerDifferences} changed)</span>
          </button>
        </div>

        {/* Clean typographic summary metrics */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-400">
          <span>
            Status:{' '}
            <strong className={result.summary.statusMatch ? 'text-emerald-400' : 'text-amber-400'}>
              {result.summary.statusMatch ? 'Match' : `${left.status ?? '-'} → ${right.status ?? '-'}`}
            </strong>
          </span>
          <span>·</span>
          <span>
            Δ Time:{' '}
            <strong className="text-slate-200">
              {result.summary.timeDeltaMs !== null
                ? `${result.summary.timeDeltaMs > 0 ? '+' : ''}${result.summary.timeDeltaMs}ms`
                : 'N/A'}
            </strong>
          </span>
          <span>·</span>
          <span className="text-emerald-400">+{result.summary.additions} added</span>
          <span>·</span>
          <span className="text-red-400">-{result.summary.removals} removed</span>
          <span>·</span>
          <span className="text-amber-400">~{result.summary.modifications + result.summary.typeChanges} modified</span>
        </div>
      </div>

      {/* Diff Output */}
      <div className="flex-1 overflow-y-auto p-4 select-text">
        {activeTab === 'json' && (
          <div className="space-y-2">
            {!result.isJsonComparable ? (
              <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 text-xs text-slate-400">
                One or both response bodies are not valid JSON. Switch to the <strong>Text Diff</strong> tab to inspect line-by-line differences.
              </div>
            ) : result.jsonDiffs.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                Both JSON payloads are structurally identical.
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">JSONPath</th>
                      <th className="py-2 px-3 w-28">Change</th>
                      <th className="py-2 px-3">Response A</th>
                      <th className="py-2 px-3">Response B</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {result.jsonDiffs.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 text-cyan-300 break-all">{d.path}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold border ${
                              d.type === 'added'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : d.type === 'removed'
                                ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                : d.type === 'type_changed'
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {d.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-red-300/90 break-all max-w-xs">
                          {d.leftValue !== undefined ? JSON.stringify(d.leftValue) : '—'}
                        </td>
                        <td className="py-2 px-3 text-emerald-300/90 break-all max-w-xs">
                          {d.rightValue !== undefined ? JSON.stringify(d.rightValue) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-1 text-xs">
              <button
                type="button"
                onClick={() => setTextViewMode('side-by-side')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  textViewMode === 'side-by-side'
                    ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                onClick={() => setTextViewMode('unified')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  textViewMode === 'unified'
                    ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Unified
              </button>
            </div>

            {textViewMode === 'unified' ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 font-mono text-[11px] overflow-x-auto">
                {result.textDiffLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start px-3 py-0.5 whitespace-pre-wrap break-all ${
                      line.type === 'added'
                        ? 'bg-emerald-500/12 text-emerald-300'
                        : line.type === 'removed'
                        ? 'bg-red-500/12 text-red-300'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="w-10 text-slate-600 shrink-0 tabular-nums">
                      {line.lineNumberLeft ?? ''}
                    </span>
                    <span className="w-10 text-slate-600 shrink-0 tabular-nums">
                      {line.lineNumberRight ?? ''}
                    </span>
                    <span className="w-4 shrink-0">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span className="flex-1">{line.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 rounded-lg border border-slate-800 bg-slate-950 font-mono text-[11px] overflow-hidden">
                <div className="border-r border-slate-800">
                  <div className="px-3 py-1.5 bg-slate-900/80 text-slate-400 border-b border-slate-800 font-sans text-xs font-medium">
                    {left.label}
                  </div>
                  {result.textDiffLines
                    .filter((l) => l.type !== 'added')
                    .map((line, idx) => (
                      <div
                        key={idx}
                        className={`flex px-2 py-0.5 whitespace-pre-wrap break-all ${
                          line.type === 'removed' ? 'bg-red-500/15 text-red-300' : 'text-slate-400'
                        }`}
                      >
                        <span className="w-8 text-slate-600 shrink-0 tabular-nums">
                          {line.lineNumberLeft ?? ''}
                        </span>
                        <span className="flex-1">{line.value}</span>
                      </div>
                    ))}
                </div>
                <div>
                  <div className="px-3 py-1.5 bg-slate-900/80 text-slate-400 border-b border-slate-800 font-sans text-xs font-medium">
                    {right.label}
                  </div>
                  {result.textDiffLines
                    .filter((l) => l.type !== 'removed')
                    .map((line, idx) => (
                      <div
                        key={idx}
                        className={`flex px-2 py-0.5 whitespace-pre-wrap break-all ${
                          line.type === 'added' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400'
                        }`}
                      >
                        <span className="w-8 text-slate-600 shrink-0 tabular-nums">
                          {line.lineNumberRight ?? ''}
                        </span>
                        <span className="flex-1">{line.value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="rounded-lg border border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Header</th>
                  <th className="py-2 px-3 w-28">Status</th>
                  <th className="py-2 px-3">Response A</th>
                  <th className="py-2 px-3">Response B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {result.headerDiffs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 font-sans">
                      No headers present on either response.
                    </td>
                  </tr>
                ) : (
                  result.headerDiffs.map((h) => (
                    <tr key={h.key} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 text-slate-200">
                        {h.key}
                        {h.isSensitive && (
                          <span className="ml-1.5 text-[10px] text-amber-400">(sensitive)</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold border ${
                            h.status === 'identical'
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : h.status === 'only_right'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : h.status === 'only_left'
                              ? 'bg-red-500/15 text-red-300 border-red-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {h.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300 break-all">{h.leftValue ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-300 break-all">{h.rightValue ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
