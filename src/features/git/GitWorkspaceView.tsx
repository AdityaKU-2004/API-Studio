import React, { useState } from 'react';
import {
  GitBranch,
  GitCommitHorizontal,
  FolderOpen,
  Plus,
  RefreshCw,
  ShieldAlert,
  RotateCcw,
  CheckSquare,
  MinusSquare,
  Info,
} from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useDesktopStore } from '../../stores/desktopStore';

export const GitWorkspaceView: React.FC = () => {
  const {
    repoConfig,
    statusEntries,
    branches,
    commits,
    selectedDiff,
    secretFindings,
    isLoading,
    error,
    initOrOpenRepo,
    refreshRepo,
    stagePaths,
    unstagePaths,
    commitChanges,
    createBranch,
    switchBranch,
    inspectDiff,
    discardChanges,
  } = useGitStore();
  const { capabilities } = useDesktopStore();

  const [repoPathInput, setRepoPathInput] = useState(repoConfig?.repoPath || '');
  const [commitMessage, setCommitMessage] = useState('');
  const [authorName, setAuthorName] = useState(repoConfig?.authorName || 'Local Developer');
  const [authorEmail, setAuthorEmail] = useState(repoConfig?.authorEmail || 'developer@local.studio');
  const [newBranchName, setNewBranchName] = useState('');
  const [discardTarget, setDiscardTarget] = useState<string | null>(null);

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    const ok = await commitChanges(commitMessage, authorName, authorEmail);
    if (ok) setCommitMessage('');
  };

  return (
    <div className="h-full flex flex-col bg-[#0d111a] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Git Version Control Client</h1>
            <p className="text-[11px] text-slate-400">
              Native libgit2 repository management (branches, diffs, secret scan, and local commits — never commits secrets).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            value={repoPathInput}
            onChange={(e) => setRepoPathInput(e.target.value)}
            placeholder="/path/to/api-repo"
            className="w-64 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-slate-200"
          />
          <button
            type="button"
            onClick={() => initOrOpenRepo(repoPathInput, false)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open Repo</span>
          </button>
          <button
            type="button"
            onClick={() => initOrOpenRepo(repoPathInput, true)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Git Init</span>
          </button>
          <button
            type="button"
            disabled={!repoConfig || isLoading}
            onClick={() => refreshRepo()}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Limitations Notice */}
      <div className="mx-5 mt-4 p-3 rounded-xl bg-blue-950/30 border border-blue-500/25 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-cyan-300">
            {capabilities.isDesktop
              ? 'Local libgit2 Mode Active'
              : 'Desktop Native Runtime Required for Filesystem Git'}
          </div>
          <p className="text-[11px] text-slate-400">
            {capabilities.isDesktop
              ? 'Local init, status, staging, diffing, branch management, and pre-commit secret scanning run safely via libgit2 without shell execution. Remote SSH/HTTPS push & pull require your system git remote credentials.'
              : 'Browser sandbox cannot access local disk repositories directly. Run API Studio in Tauri Desktop mode to bind local Git folders, or export scrubbed Project ZIP snapshots.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300">
          {error}
        </div>
      )}

      {secretFindings.length > 0 && (
        <div className="mx-5 mt-3 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-300 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            <span>Pre-Commit Secret Scanner Warning ({secretFindings.length} finding(s))</span>
          </div>
          {secretFindings.map((f, i) => (
            <div key={i} className="font-mono text-[11px]">
              {f.path}:{f.line} — {f.patternName}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Branches, Changes, Commit */}
        <div className="lg:col-span-5 space-y-4">
          {/* Branches */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Branches</span>
              <span className="font-mono text-cyan-300">
                {repoConfig?.currentBranch || 'main'}
              </span>
            </div>
            <div className="flex gap-2">
              <select
                value={branches.find((b) => b.isCurrent)?.name || ''}
                onChange={(e) => switchBranch(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700"
              >
                {branches.length === 0 && <option value="main">main</option>}
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} {b.isCurrent ? '(current)' : ''}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="new-branch"
                className="w-32 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700"
              />
              <button
                type="button"
                disabled={!newBranchName.trim()}
                onClick={async () => {
                  await createBranch(newBranchName);
                  setNewBranchName('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 cursor-pointer disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>

          {/* Working Tree Status */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">
                Changed Files ({statusEntries.length})
              </span>
              {statusEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => stagePaths([])}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Stage All
                </button>
              )}
            </div>

            {statusEntries.length === 0 ? (
              <div className="py-4 text-center text-slate-500">Working tree clean.</div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {statusEntries.map((entry) => (
                  <div
                    key={entry.path}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => inspectDiff(entry.path, entry.staged)}
                      className="text-left font-mono text-[11px] truncate flex-1 hover:text-cyan-300 cursor-pointer"
                    >
                      <span
                        className={`mr-2 font-bold ${
                          entry.staged ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {entry.staged ? entry.indexStatus || 'S' : entry.worktreeStatus || 'M'}
                      </span>
                      {entry.path}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.staged ? (
                        <button
                          type="button"
                          onClick={() => unstagePaths([entry.path])}
                          title="Unstage"
                          className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                        >
                          <MinusSquare className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => stagePaths([entry.path])}
                            title="Stage"
                            className="p-1 text-slate-400 hover:text-emerald-400 cursor-pointer"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscardTarget(entry.path)}
                            title="Discard changes"
                            className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Commit Form */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Author name"
                  className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800"
                />
                <input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="Author email"
                  className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800"
                />
              </div>
              <textarea
                rows={2}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message (e.g. feat: add users v2 schema)"
                className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800"
              />
              <button
                type="button"
                disabled={!commitMessage.trim() || !capabilities.isDesktop}
                onClick={handleCommit}
                className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <GitCommitHorizontal className="w-4 h-4" />
                <span>Commit Staged Changes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Diff Viewer & Commit History */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">
                File Diff {selectedDiff ? `— ${selectedDiff.path}` : ''}
              </span>
              {selectedDiff && (
                <span className="font-mono text-[11px]">
                  <span className="text-emerald-400 mr-2">+{selectedDiff.additions}</span>
                  <span className="text-red-400">-{selectedDiff.deletions}</span>
                </span>
              )}
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] overflow-x-auto max-h-60 text-slate-300">
              {selectedDiff?.patch || 'Select a changed file to inspect its unified Git diff.'}
            </pre>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5 text-xs">
            <span className="font-semibold text-slate-200 block">
              Commit History ({commits.length})
            </span>
            {commits.length === 0 ? (
              <div className="py-6 text-center text-slate-500">No commits loaded yet.</div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {commits.map((c) => (
                  <div
                    key={c.hash}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 truncate">{c.message}</div>
                      <div className="text-[11px] text-slate-400">
                        {c.author} · {new Date(c.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <code className="font-mono text-[11px] text-cyan-400 shrink-0">
                      {c.shortHash}
                    </code>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      {discardTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-sm rounded-xl bg-[#121620] border border-red-500/30 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-red-300">Discard Uncommitted Changes?</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently discard local modifications to{' '}
              <code className="font-mono text-amber-300">{discardTarget}</code>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiscardTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = discardTarget;
                  setDiscardTarget(null);
                  await discardChanges([target]);
                }}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-medium text-white cursor-pointer"
              >
                Discard File Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
