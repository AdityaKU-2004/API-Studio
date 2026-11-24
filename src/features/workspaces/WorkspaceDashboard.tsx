import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Pin,
  Plus,
  Users,
  MessageSquare,
  Activity,
  Download,
  Upload,
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertCircle,
  FolderArchive,
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useSpecStore } from '../../stores/specStore';
import { useMockStore } from '../../stores/mockStore';
import { useContractStore } from '../../stores/contractStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import {
  commitProjectZipImport,
  exportProjectZipBlob,
  inspectAndValidateProjectZip,
} from '../../services/import-export/projectArchiveService';
import {
  getRolePermissionsList,
  hasWorkspacePermission,
} from '../../services/collaboration/workspaceService';
import {
  ProjectImportConflictStrategy,
  ProjectImportPreview,
  WorkspaceRole,
  WorkspaceType,
} from '../../types';

export const WorkspaceDashboard: React.FC = () => {
  const {
    workspaces,
    projects,
    members,
    comments,
    activityLogs,
    syncMetadata,
    activeWorkspaceId,
    activeProjectId,
    currentRole,
    setActiveWorkspace,
    setActiveProject,
    createWorkspace,
    createProject,
    togglePinProject,
    addMember,
    updateMemberRole,
    setCurrentRoleOverride,
    addComment,
    toggleResolveComment,
    pullRemoteSync,
    pushLocalSync,
    loadWorkspaces,
  } = useWorkspaceStore();

  const { collections, loadCollections } = useCollectionStore();
  const { specs, loadSpecs } = useSpecStore();
  const { servers, statuses, loadMockServers } = useMockStore();
  const { reports } = useContractStore();
  const { loadEnvironments, environments, activeEnvironmentId } = useEnvironmentStore();

  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<WorkspaceType>('team');
  const [newProjName, setNewProjName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Editor');
  const [commentBody, setCommentBody] = useState('');

  // Project ZIP export/import state
  const [includeSecretsInZip, setIncludeSecretsInZip] = useState(false);
  const [zipPreview, setZipPreview] = useState<ProjectImportPreview | null>(null);
  const [importStrategy, setImportStrategy] =
    useState<ProjectImportConflictStrategy>('merge-new-ids');
  const [zipMessage, setZipMessage] = useState<string | null>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const workspaceProjects = useMemo(
    () =>
      projects
        .filter((p) => p.workspaceId === activeWorkspaceId)
        .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))),
    [projects, activeWorkspaceId]
  );
  const workspaceMembers = useMemo(
    () => members.filter((m) => m.workspaceId === activeWorkspaceId),
    [members, activeWorkspaceId]
  );
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  const canManageMembers = hasWorkspacePermission(currentRole, 'workspace:manage-members');
  const canCreateProject = hasWorkspacePermission(currentRole, 'project:create');

  const handleExportProjectZip = async () => {
    if (!activeProject || !activeWorkspace) return;
    const { blob, fileName } = await exportProjectZipBlob({
      project: activeProject,
      workspaceName: activeWorkspace.name,
      includeSecrets: includeSecretsInZip,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setZipMessage(`Exported "${fileName}" cleanly.`);
  };

  const handleSelectZipFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    inspectAndValidateProjectZip(file)
      .then((preview) => {
        setZipPreview(preview);
        setZipMessage(null);
      })
      .catch((err) => {
        setZipMessage(`Failed to inspect ZIP archive: ${(err as Error).message}`);
      });
  };

  const handleConfirmZipImport = async () => {
    if (!zipPreview || !zipPreview.validation.valid) return;
    const result = await commitProjectZipImport(zipPreview, {
      workspaceId: activeWorkspaceId,
      strategy: importStrategy,
    });
    await Promise.all([
      loadCollections(),
      loadEnvironments(),
      loadSpecs(),
      loadMockServers(),
      loadWorkspaces(),
    ]);
    await setActiveProject(result.importedProjectId);
    setZipPreview(null);
    setZipMessage(
      `Imported project cleanly (${result.counts.collections} collections, ${result.counts.specs} specs, ${result.counts.mockServers} mocks).`
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0d111a] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Briefcase className="w-4 h-4 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">
              Workspaces, Projects & Collaboration Dashboard
            </h1>
            <p className="text-[11px] text-slate-400">
              Organize projects, inspect role permissions, review comments & activity, and export/import full Project ZIP packages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Active Role Preview:</span>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRoleOverride(e.target.value as WorkspaceRole)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-medium"
          >
            {(['Owner', 'Admin', 'Editor', 'Viewer'] as WorkspaceRole[]).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Local-First Sync Abstraction Banner */}
        <div className="p-3.5 rounded-xl bg-blue-950/25 border border-blue-500/25 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Provider Abstraction: {syncMetadata?.status || 'local-only'}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {syncMetadata?.notice ||
                'Local-first storage active. Cloud multi-device sync requires configuring a future collaboration server.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pullRemoteSync()}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              Check Remote
            </button>
            <button
              type="button"
              onClick={() => pushLocalSync()}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              Verify Local
            </button>
          </div>
        </div>

        {/* Summary Dashboard Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">Collections</div>
            <div className="text-lg font-bold text-slate-100">{collections.length}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">OpenAPI Specs</div>
            <div className="text-lg font-bold text-cyan-300">{specs.length}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">Active Environment</div>
            <div className="text-sm font-semibold text-emerald-300 truncate mt-1">
              {activeEnv?.name || 'None'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">Mock Servers</div>
            <div className="text-lg font-bold text-amber-300">
              {Object.values(statuses).filter((s) => s.running).length} / {servers.length} running
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">Contract Runs</div>
            <div className="text-lg font-bold text-slate-100">{reports.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Workspaces & Projects + ZIP Archive */}
          <div className="lg:col-span-7 space-y-5">
            {/* Workspaces & Projects */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-100">Workspaces & Projects</h3>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    placeholder="New workspace..."
                    className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700"
                  />
                  <select
                    value={newWsType}
                    onChange={(e) => setNewWsType(e.target.value as WorkspaceType)}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-700"
                  >
                    <option value="personal">Personal</option>
                    <option value="team">Team</option>
                    <option value="project">Project</option>
                  </select>
                  <button
                    type="button"
                    disabled={!newWsName.trim()}
                    onClick={async () => {
                      await createWorkspace({
                        name: newWsName,
                        description: `${newWsType} workspace`,
                        type: newWsType,
                      });
                      setNewWsName('');
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setActiveWorkspace(ws.id)}
                    className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                      ws.id === activeWorkspaceId
                        ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ws.name} <span className="text-[10px] opacity-70">({ws.type})</span>
                  </button>
                ))}
              </div>

              {/* Projects in Workspace */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-300">
                    Projects in {activeWorkspace?.name}
                  </span>
                  {canCreateProject && (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newProjName}
                        onChange={(e) => setNewProjName(e.target.value)}
                        placeholder="New project name..."
                        className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700"
                      />
                      <button
                        type="button"
                        disabled={!newProjName.trim()}
                        onClick={async () => {
                          await createProject({
                            workspaceId: activeWorkspaceId,
                            name: newProjName,
                            description: 'API Lifecycle Project',
                          });
                          setNewProjName('');
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Project</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {workspaceProjects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => setActiveProject(proj.id)}
                      className={`p-3 rounded-lg border cursor-pointer flex items-start justify-between gap-2 ${
                        proj.id === activeProjectId
                          ? 'bg-blue-950/30 border-cyan-500/40'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100 truncate">{proj.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{proj.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinProject(proj.id);
                        }}
                        className={`p-1 rounded cursor-pointer ${
                          proj.isPinned ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'
                        }`}
                        title="Pin Project"
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Project ZIP Import / Export */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-100">
                  <FolderArchive className="w-4 h-4 text-cyan-400" />
                  <span>Full Project ZIP Package (Export & Validated Import)</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSecretsInZip}
                    onChange={(e) => setIncludeSecretsInZip(e.target.checked)}
                  />
                  <span>Include secret variable values (scrubbed by default)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportProjectZip}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Project .ZIP</span>
                  </button>

                  <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Import .ZIP</span>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleSelectZipFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {zipMessage && (
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
                  {zipMessage}
                </div>
              )}

              {zipPreview && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">
                      ZIP Preview: {zipPreview.manifest.projectName}
                    </span>
                    {zipPreview.validation.valid ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Safe Archive
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Blocked
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Collections: {zipPreview.manifest.counts.collections} · Requests:{' '}
                    {zipPreview.manifest.counts.requests} · Specs: {zipPreview.manifest.counts.specs}{' '}
                    · Mocks: {zipPreview.manifest.counts.mockServers}
                  </div>
                  {zipPreview.validation.errors.map((err, i) => (
                    <div key={i} className="text-red-400 text-[11px]">
                      {err}
                    </div>
                  ))}
                  {zipPreview.validation.warnings.map((w, i) => (
                    <div key={i} className="text-amber-300 text-[11px]">
                      {w}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <select
                      value={importStrategy}
                      onChange={(e) =>
                        setImportStrategy(e.target.value as ProjectImportConflictStrategy)
                      }
                      className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700"
                    >
                      <option value="merge-new-ids">Create New IDs (Non-destructive)</option>
                      <option value="skip-existing">Skip Existing IDs</option>
                      <option value="overwrite-matching">Overwrite Matching IDs</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setZipPreview(null)}
                        className="px-2.5 py-1 text-slate-400 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!zipPreview.validation.valid}
                        onClick={handleConfirmZipImport}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
                      >
                        Confirm Import
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: RBAC Members, Comments & Activity Feed */}
          <div className="lg:col-span-5 space-y-5">
            {/* Members & RBAC */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Workspace Members & Permissions</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {getRolePermissionsList(currentRole).length} granted ops ({currentRole})
                </span>
              </div>

              {canManageMembers ? (
                <div className="flex gap-1.5">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@example.com"
                    className="flex-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-700"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-700"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Editor">Editor</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                  <button
                    type="button"
                    disabled={!inviteEmail.trim()}
                    onClick={async () => {
                      await addMember({
                        workspaceId: activeWorkspaceId,
                        name: inviteEmail.split('@')[0],
                        email: inviteEmail,
                        role: inviteRole,
                      });
                      setInviteEmail('');
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50"
                  >
                    Invite
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-amber-300 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Role &ldquo;{currentRole}&rdquo; has read-only member permissions.</span>
                </div>
              )}

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {workspaceMembers.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="truncate">
                      <span className="font-medium text-slate-200">{m.name}</span>
                      <span className="text-slate-500 ml-1.5">{m.email}</span>
                    </div>
                    <select
                      disabled={!canManageMembers}
                      value={m.role}
                      onChange={(e) => updateMemberRole(m.id, e.target.value as WorkspaceRole)}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px]"
                    >
                      <option value="Owner">Owner</option>
                      <option value="Admin">Admin</option>
                      <option value="Editor">Editor</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Collaboration Comments */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Review Comments</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add comment on current project/spec..."
                  className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700"
                />
                <button
                  type="button"
                  disabled={!commentBody.trim()}
                  onClick={async () => {
                    await addComment({
                      targetType: 'project',
                      targetId: activeProjectId,
                      targetLabel: activeProject?.name || 'Project',
                      body: commentBody,
                    });
                    setCommentBody('');
                  }}
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer disabled:opacity-50"
                >
                  Post
                </button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-2 rounded bg-slate-950 border border-slate-800 flex items-start justify-between gap-2 ${
                      c.resolved ? 'opacity-60' : ''
                    }`}
                  >
                    <div>
                      <div className="text-[11px] text-cyan-300 font-medium">
                        {c.authorName} ({c.authorRole}) · {c.targetLabel}
                      </div>
                      <p className="text-slate-200">{c.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleResolveComment(c.id)}
                      className="text-[10px] text-emerald-400 hover:underline shrink-0 cursor-pointer"
                    >
                      {c.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Log */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Recent Activity</span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {activityLogs.slice(0, 12).map((act) => (
                  <div key={act.id} className="text-[11px] text-slate-300 flex justify-between">
                    <span className="truncate">
                      <strong>{act.actorName}</strong> {act.action}{' '}
                      <span className="text-cyan-300">{act.resourceName}</span>
                    </span>
                    <span className="text-slate-500 shrink-0 ml-2">
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
