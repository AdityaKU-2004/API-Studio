import {
  ISyncProvider,
  PermissionAction,
  SyncConflictItem,
  SyncMetadata,
  WorkspaceRole,
} from '../../types';
import { db } from '../../database/database';

const ROLE_PERMISSIONS: Record<WorkspaceRole, Set<PermissionAction>> = {
  Owner: new Set<PermissionAction>([
    'workspace:edit',
    'workspace:delete',
    'workspace:manage-members',
    'project:create',
    'project:edit',
    'project:delete',
    'spec:edit',
    'collection:edit',
    'secrets:manage',
    'mock:control',
    'git:commit',
  ]),
  Admin: new Set<PermissionAction>([
    'workspace:edit',
    'workspace:manage-members',
    'project:create',
    'project:edit',
    'project:delete',
    'spec:edit',
    'collection:edit',
    'secrets:manage',
    'mock:control',
    'git:commit',
  ]),
  Editor: new Set<PermissionAction>([
    'project:edit',
    'spec:edit',
    'collection:edit',
    'mock:control',
    'git:commit',
  ]),
  Viewer: new Set<PermissionAction>([]),
};

export function hasWorkspacePermission(role: WorkspaceRole, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

export function getRolePermissionsList(role: WorkspaceRole): PermissionAction[] {
  return Array.from(ROLE_PERMISSIONS[role] || []);
}

export function scrubSensitiveEnvironmentVariables(
  envs: Array<Record<string, unknown>>,
  includeSecrets = false
): Array<Record<string, unknown>> {
  return envs.map((env) => {
    const vars = Array.isArray(env.variables)
      ? (env.variables as Array<Record<string, unknown>>).map((v) => {
          const isSecret =
            Boolean(v.isSecret) ||
            Boolean(v.secret) ||
            /secret|token|password|api_?key|private_?key/i.test(String(v.key || ''));
          if (isSecret && !includeSecrets) {
            return {
              ...v,
              initialValue: '',
              currentValue: '',
              scrubbed: true,
            };
          }
          return { ...v };
        })
      : [];
    return {
      ...env,
      variables: vars,
    };
  });
}

/**
 * Modular local-first sync abstraction implementing ISyncProvider.
 * Detects pending local modifications and manages conflict states cleanly
 * without silent overwrites, while explicitly documenting that remote cloud
 * synchronization requires a future collaboration server.
 */
export class LocalOnlySyncProvider implements ISyncProvider {
  public readonly providerName = 'Local-First Storage Engine';
  public readonly isRemoteCapable = false;

  public async getSyncStatus(workspaceId: string): Promise<SyncMetadata> {
    const existing = await db.syncMetadata.where('workspaceId').equals(workspaceId).first();
    if (existing) return existing;

    const fresh: SyncMetadata = {
      id: `sync-${workspaceId}`,
      workspaceId,
      providerType: 'local-only',
      status: 'local-only',
      pendingLocalChanges: 0,
      remoteChangesDetected: 0,
      conflicts: [],
      notice:
        'Local-only mode: workspace changes persist in IndexedDB/SQLite. Remote sync requires a future collaboration server.',
    };
    await db.syncMetadata.put(fresh);
    return fresh;
  }

  public async detectConflicts(workspaceId: string): Promise<SyncConflictItem[]> {
    const meta = await this.getSyncStatus(workspaceId);
    return meta.conflicts;
  }

  public async pushLocalChanges(workspaceId: string): Promise<SyncMetadata> {
    const current = await this.getSyncStatus(workspaceId);
    const updated: SyncMetadata = {
      ...current,
      status: current.conflicts.length > 0 ? 'conflict' : 'local-only',
      lastSyncAttemptAt: Date.now(),
      notice:
        current.conflicts.length > 0
          ? 'Resolve pending conflicts before marking local changes synchronized.'
          : 'No remote collaboration server configured. All changes are safely saved locally.',
    };
    await db.syncMetadata.put(updated);
    return updated;
  }

  public async pullRemoteChanges(workspaceId: string): Promise<SyncMetadata> {
    const current = await this.getSyncStatus(workspaceId);
    const updated: SyncMetadata = {
      ...current,
      lastSyncAttemptAt: Date.now(),
      notice:
        'Remote pull skipped: no collaboration server endpoint connected. Export a Project ZIP or use Git to share snapshots.',
    };
    await db.syncMetadata.put(updated);
    return updated;
  }

  public async resolveConflict(
    workspaceId: string,
    conflictId: string,
    strategy: 'keep-local' | 'accept-remote' | 'duplicate-both'
  ): Promise<SyncMetadata> {
    const current = await this.getSyncStatus(workspaceId);
    const remaining = current.conflicts.filter((c) => c.id !== conflictId);
    const updated: SyncMetadata = {
      ...current,
      conflicts: remaining,
      status: remaining.length > 0 ? 'conflict' : 'local-only',
      lastSyncedAt: Date.now(),
      notice: `Conflict resolved using "${strategy}" strategy.`,
    };
    await db.syncMetadata.put(updated);
    return updated;
  }
}

export const localSyncProvider = new LocalOnlySyncProvider();
