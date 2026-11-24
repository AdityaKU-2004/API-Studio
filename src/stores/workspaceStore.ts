import { create } from 'zustand';
import {
  ActivityLogEntry,
  CollaborationComment,
  ProjectRecord,
  SyncMetadata,
  WorkspaceMember,
  WorkspaceRecord,
  WorkspaceRole,
  WorkspaceType,
} from '../types';
import { db } from '../database/database';
import { localSyncProvider } from '../services/collaboration/workspaceService';
import { useAppStore } from './appStore';

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface WorkspaceState {
  workspaces: WorkspaceRecord[];
  projects: ProjectRecord[];
  members: WorkspaceMember[];
  comments: CollaborationComment[];
  activityLogs: ActivityLogEntry[];
  syncMetadata: SyncMetadata | null;
  activeWorkspaceId: string;
  activeProjectId: string;
  currentRole: WorkspaceRole;
  isLoaded: boolean;

  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (workspaceId: string) => Promise<void>;
  setActiveProject: (projectId: string) => Promise<void>;
  createWorkspace: (input: { name: string; description: string; type: WorkspaceType }) => Promise<WorkspaceRecord>;
  createProject: (input: { workspaceId: string; name: string; description: string }) => Promise<ProjectRecord>;
  togglePinProject: (projectId: string) => Promise<void>;
  addMember: (input: { workspaceId: string; name: string; email: string; role: WorkspaceRole }) => Promise<void>;
  updateMemberRole: (memberId: string, role: WorkspaceRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  setCurrentRoleOverride: (role: WorkspaceRole) => void;
  addComment: (input: {
    targetType: CollaborationComment['targetType'];
    targetId: string;
    targetLabel: string;
    body: string;
  }) => Promise<void>;
  toggleResolveComment: (commentId: string) => Promise<void>;
  recordActivity: (input: {
    action: string;
    resourceType: string;
    resourceName: string;
    details?: string;
  }) => Promise<void>;
  refreshSyncStatus: () => Promise<void>;
  pullRemoteSync: () => Promise<void>;
  pushLocalSync: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  projects: [],
  members: [],
  comments: [],
  activityLogs: [],
  syncMetadata: null,
  activeWorkspaceId: 'ws-default',
  activeProjectId: 'proj-default',
  currentRole: 'Owner',
  isLoaded: false,

  loadWorkspaces: async () => {
    const [workspaces, projects, members, comments, activityLogs] = await Promise.all([
      db.workspaces.toArray(),
      db.projects.toArray(),
      db.workspaceMembers.toArray(),
      db.collaborationComments.toArray(),
      db.activityLogs.orderBy('timestamp').reverse().limit(100).toArray(),
    ]);

    const savedWsId = localStorage.getItem('api_studio_active_workspace') || 'ws-default';
    const activeWorkspaceId =
      workspaces.find((w) => w.id === savedWsId)?.id || workspaces[0]?.id || 'ws-default';

    const wsProjects = projects.filter((p) => p.workspaceId === activeWorkspaceId);
    const savedProjId = localStorage.getItem('api_studio_active_project') || 'proj-default';
    const activeProjectId =
      wsProjects.find((p) => p.id === savedProjId)?.id || wsProjects[0]?.id || projects[0]?.id || 'proj-default';

    const syncMetadata = await localSyncProvider.getSyncStatus(activeWorkspaceId);

    set({
      workspaces,
      projects,
      members,
      comments: comments.sort((a, b) => b.createdAt - a.createdAt),
      activityLogs,
      syncMetadata,
      activeWorkspaceId,
      activeProjectId,
      isLoaded: true,
    });

    if (workspaces.length > 0) {
      useAppStore.getState().setActiveWorkspaceId(activeWorkspaceId);
    }
  },

  setActiveWorkspace: async (workspaceId) => {
    localStorage.setItem('api_studio_active_workspace', workspaceId);
    const wsProjects = get().projects.filter((p) => p.workspaceId === workspaceId);
    const nextProjectId = wsProjects[0]?.id || get().activeProjectId;
    const syncMetadata = await localSyncProvider.getSyncStatus(workspaceId);
    set({ activeWorkspaceId: workspaceId, activeProjectId: nextProjectId, syncMetadata });
    useAppStore.getState().setActiveWorkspaceId(workspaceId);
  },

  setActiveProject: async (projectId) => {
    localStorage.setItem('api_studio_active_project', projectId);
    const target = get().projects.find((p) => p.id === projectId);
    if (target) {
      const updated: ProjectRecord = { ...target, lastOpenedAt: Date.now(), updatedAt: Date.now() };
      await db.projects.put(updated);
      set((s) => ({
        activeProjectId: projectId,
        projects: s.projects.map((p) => (p.id === projectId ? updated : p)),
      }));
    } else {
      set({ activeProjectId: projectId });
    }
  },

  createWorkspace: async ({ name, description, type }) => {
    const now = Date.now();
    const ws: WorkspaceRecord = {
      id: makeId('ws'),
      name: name.trim() || 'Untitled Workspace',
      description: description.trim(),
      type,
      ownerName: 'Local Developer',
      createdAt: now,
      updatedAt: now,
    };
    const ownerMember: WorkspaceMember = {
      id: makeId('mem'),
      workspaceId: ws.id,
      name: 'Local Developer',
      email: 'developer@local.studio',
      role: 'Owner',
      status: 'active',
      joinedAt: now,
    };
    await db.workspaces.put(ws);
    await db.workspaceMembers.put(ownerMember);
    const defaultProj = await get().createProject({
      workspaceId: ws.id,
      name: `${ws.name} Default Project`,
      description: 'Primary API lifecycle project',
    });
    set((s) => ({
      workspaces: [...s.workspaces, ws],
      members: [...s.members, ownerMember],
      activeWorkspaceId: ws.id,
      activeProjectId: defaultProj.id,
    }));
    await get().recordActivity({
      action: 'created workspace',
      resourceType: 'workspace',
      resourceName: ws.name,
    });
    return ws;
  },

  createProject: async ({ workspaceId, name, description }) => {
    const now = Date.now();
    const proj: ProjectRecord = {
      id: makeId('proj'),
      workspaceId,
      name: name.trim() || 'Untitled Project',
      description: description.trim(),
      collectionIds: [],
      specIds: [],
      mockServerIds: [],
      isPinned: false,
      lastOpenedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await db.projects.put(proj);
    set((s) => ({ projects: [...s.projects, proj] }));
    await get().recordActivity({
      action: 'created project',
      resourceType: 'project',
      resourceName: proj.name,
    });
    return proj;
  },

  togglePinProject: async (projectId) => {
    const proj = get().projects.find((p) => p.id === projectId);
    if (!proj) return;
    const updated: ProjectRecord = { ...proj, isPinned: !proj.isPinned, updatedAt: Date.now() };
    await db.projects.put(updated);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === projectId ? updated : p)),
    }));
  },

  addMember: async ({ workspaceId, name, email, role }) => {
    const now = Date.now();
    const member: WorkspaceMember = {
      id: makeId('mem'),
      workspaceId,
      name: name.trim(),
      email: email.trim(),
      role,
      status: 'invited',
      invitedAt: now,
    };
    await db.workspaceMembers.put(member);
    set((s) => ({ members: [...s.members, member] }));
    await get().recordActivity({
      action: `invited ${role}`,
      resourceType: 'member',
      resourceName: member.email,
    });
  },

  updateMemberRole: async (memberId, role) => {
    const member = get().members.find((m) => m.id === memberId);
    if (!member) return;
    const updated = { ...member, role };
    await db.workspaceMembers.put(updated);
    set((s) => ({
      members: s.members.map((m) => (m.id === memberId ? updated : m)),
    }));
    await get().recordActivity({
      action: `changed role to ${role}`,
      resourceType: 'member',
      resourceName: member.name,
    });
  },

  removeMember: async (memberId) => {
    await db.workspaceMembers.delete(memberId);
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }));
  },

  setCurrentRoleOverride: (role) => set({ currentRole: role }),

  addComment: async ({ targetType, targetId, targetLabel, body }) => {
    const now = Date.now();
    const comment: CollaborationComment = {
      id: makeId('cmt'),
      workspaceId: get().activeWorkspaceId,
      targetType,
      targetId,
      targetLabel,
      authorName: 'Local Developer',
      authorRole: get().currentRole,
      body: body.trim(),
      resolved: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.collaborationComments.put(comment);
    set((s) => ({ comments: [comment, ...s.comments] }));
    await get().recordActivity({
      action: 'commented on',
      resourceType: targetType,
      resourceName: targetLabel,
    });
  },

  toggleResolveComment: async (commentId) => {
    const cmt = get().comments.find((c) => c.id === commentId);
    if (!cmt) return;
    const updated = { ...cmt, resolved: !cmt.resolved, updatedAt: Date.now() };
    await db.collaborationComments.put(updated);
    set((s) => ({
      comments: s.comments.map((c) => (c.id === commentId ? updated : c)),
    }));
  },

  recordActivity: async ({ action, resourceType, resourceName, details }) => {
    const entry: ActivityLogEntry = {
      id: makeId('act'),
      workspaceId: get().activeWorkspaceId,
      projectId: get().activeProjectId,
      actorName: 'Local Developer',
      action,
      resourceType,
      resourceName,
      details,
      timestamp: Date.now(),
    };
    await db.activityLogs.put(entry);
    set((s) => ({ activityLogs: [entry, ...s.activityLogs].slice(0, 100) }));
  },

  refreshSyncStatus: async () => {
    const meta = await localSyncProvider.getSyncStatus(get().activeWorkspaceId);
    set({ syncMetadata: meta });
  },

  pullRemoteSync: async () => {
    const meta = await localSyncProvider.pullRemoteChanges(get().activeWorkspaceId);
    set({ syncMetadata: meta });
  },

  pushLocalSync: async () => {
    const meta = await localSyncProvider.pushLocalChanges(get().activeWorkspaceId);
    set({ syncMetadata: meta });
  },
}));
