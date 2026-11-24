import { create } from 'zustand';
import {
  GitBranchInfo,
  GitCommitEntry,
  GitDiffResult,
  GitRepoConfig,
  GitSecretFinding,
  GitStatusEntry,
} from '../types';
import { db } from '../database/database';
import { isTauriRuntime } from '../services/runtime/capabilities';
import { invokeDesktop } from '../services/desktop/tauriBridge';
import { useWorkspaceStore } from './workspaceStore';

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface GitState {
  repoConfig: GitRepoConfig | null;
  statusEntries: GitStatusEntry[];
  branches: GitBranchInfo[];
  commits: GitCommitEntry[];
  selectedDiff: GitDiffResult | null;
  secretFindings: GitSecretFinding[];
  isLoading: boolean;
  error: string | null;

  loadGitConfig: () => Promise<void>;
  initOrOpenRepo: (repoPath: string, initNew?: boolean) => Promise<void>;
  refreshRepo: () => Promise<void>;
  stagePaths: (paths: string[]) => Promise<void>;
  unstagePaths: (paths: string[]) => Promise<void>;
  commitChanges: (message: string, authorName: string, authorEmail: string) => Promise<boolean>;
  createBranch: (name: string) => Promise<void>;
  switchBranch: (name: string) => Promise<void>;
  inspectDiff: (filePath: string, staged: boolean) => Promise<void>;
  discardChanges: (paths: string[]) => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  repoConfig: null,
  statusEntries: [],
  branches: [],
  commits: [],
  selectedDiff: null,
  secretFindings: [],
  isLoading: false,
  error: null,

  loadGitConfig: async () => {
    const configs = await db.gitRepos.orderBy('updatedAt').reverse().toArray();
    const repoConfig = configs[0] || null;
    set({ repoConfig });
    if (repoConfig && isTauriRuntime()) {
      await get().refreshRepo();
    }
  },

  initOrOpenRepo: async (repoPath, initNew = false) => {
    if (!isTauriRuntime()) {
      set({
        error:
          'Local filesystem Git integration requires the Tauri Desktop runtime (powered by libgit2). Remote cloud Git push/pull credentials are not supported inside browser mode.',
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const normalizedPath = initNew
        ? await invokeDesktop<string>('git_init_repo', { repoPath })
        : repoPath.trim();

      const now = Date.now();
      const ws = useWorkspaceStore.getState();
      const cfg: GitRepoConfig = {
        id: get().repoConfig?.id || makeId('git'),
        projectId: ws.activeProjectId,
        repoPath: normalizedPath,
        currentBranch: 'main',
        authorName: get().repoConfig?.authorName || 'Local Developer',
        authorEmail: get().repoConfig?.authorEmail || 'developer@local.studio',
        updatedAt: now,
      };
      await db.gitRepos.put(cfg);
      set({ repoConfig: cfg });
      await get().refreshRepo();
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to open/initialize Git repository',
      });
    }
  },

  refreshRepo: async () => {
    const cfg = get().repoConfig;
    if (!cfg || !isTauriRuntime()) return;
    set({ isLoading: true, error: null });
    try {
      const [statusEntries, branches, commits, secretFindings] = await Promise.all([
        invokeDesktop<GitStatusEntry[]>('git_status', { repoPath: cfg.repoPath }),
        invokeDesktop<GitBranchInfo[]>('git_list_branches', { repoPath: cfg.repoPath }),
        invokeDesktop<GitCommitEntry[]>('git_list_commits', { repoPath: cfg.repoPath, limit: 30 }),
        invokeDesktop<GitSecretFinding[]>('git_scan_staged_secrets', { repoPath: cfg.repoPath }),
      ]);
      const currentBranch = branches.find((b) => b.isCurrent)?.name || cfg.currentBranch;
      const updated = { ...cfg, currentBranch, updatedAt: Date.now() };
      await db.gitRepos.put(updated);
      set({
        repoConfig: updated,
        statusEntries,
        branches,
        commits,
        secretFindings,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to read Git repository state',
      });
    }
  },

  stagePaths: async (paths) => {
    const cfg = get().repoConfig;
    if (!cfg || !isTauriRuntime()) return;
    await invokeDesktop<void>('git_stage_paths', { repoPath: cfg.repoPath, paths });
    await get().refreshRepo();
  },

  unstagePaths: async (paths) => {
    const cfg = get().repoConfig;
    if (!cfg || !isTauriRuntime()) return;
    await invokeDesktop<void>('git_unstage_paths', { repoPath: cfg.repoPath, paths });
    await get().refreshRepo();
  },

  commitChanges: async (message, authorName, authorEmail) => {
    const cfg = get().repoConfig;
    if (!cfg || !isTauriRuntime()) return false;
    try {
      const hash = await invokeDesktop<string>('git_commit_changes', {
        repoPath: cfg.repoPath,
        message,
        authorName,
        authorEmail,
      });
      await db.gitRepos.put({
        ...cfg,
        authorName,
        authorEmail,
        lastCommitHash: hash,
        updatedAt: Date.now(),
      });
      await get().refreshRepo();
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Git commit failed' });
      return false;
    }
  },

  createBranch: async (name) => {
    const cfg = get().repoConfig;
    if (!cfg || !isTauriRuntime()) return;
    await invokeDesktop<void>('git_create_branch', { repoPath: cfg.repoPath, name });
    await get().refreshRepo();
  },

  switchBranch: async (name) => {
    const cfg = get().repoConfig;
    if (!cfg || !isTauriRuntime()) return;
    await invokeDesktop<void>('git_switch_branch', { repoPath: cfg.repoPath, name });
    await get().refreshRepo();
  },

  inspectDiff: async (filePath, staged) => {
    const cfg = get().repoConfig;
    if (!cfg || !isTauriRuntime()) return;
    const diff = await invokeDesktop<GitDiffResult>('git_diff_file', {
      repoPath: cfg.repoPath,
      filePath,
      staged,
    });
    set({ selectedDiff: diff });
  },

  discardChanges: async (paths) => {
    const cfg = get().repoConfig;
    if (!cfg || !isTauriRuntime()) return;
    await invokeDesktop<void>('git_discard_changes', { repoPath: cfg.repoPath, paths });
    await get().refreshRepo();
  },
}));
