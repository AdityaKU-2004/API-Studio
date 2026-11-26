import React, { useState, useRef, useCallback } from 'react';
import {
  Folder,
  Clock,
  Layers,
  PlayCircle,
  FlaskConical,
  BarChart3,
  FileCode2,
  FileJson,
  Cpu,
  Server,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  GitCompare,
  Wrench,
  FileEdit,
  BookOpen,
  GitBranch,
  History,
  ShieldCheck,
  Building2,
  Activity,
  ShieldAlert,
  HeartPulse,
  Eye,
  Database,
  GitFork,
  Workflow,
  GitCommitHorizontal,
  Terminal,
  BarChart2,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useUiStore } from '../../stores/uiStore';
import { SidebarSection } from '../../types';
import { CollectionTree } from '../collections/CollectionTree';
import { EnvironmentManager } from '../environments/EnvironmentManager';
import { HistoryPage } from '../history/HistoryPage';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRunnerStore } from '../../stores/runnerStore';

interface NavGroup {
  id: string;
  label: string;
  items: { id: SidebarSection; label: string; icon: React.ReactNode }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'api-dev',
    label: 'API Development',
    items: [
      { id: 'collections', label: 'Collections', icon: <Folder className="w-4 h-4" /> },
      { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
      { id: 'environments', label: 'Environments', icon: <Layers className="w-4 h-4" /> },
    ],
  },
  {
    id: 'api-design',
    label: 'API Design',
    items: [
      { id: 'apis', label: 'API Explorer', icon: <Cpu className="w-4 h-4" /> },
      { id: 'spec-editor', label: 'Spec Editor', icon: <FileEdit className="w-4 h-4" /> },
      { id: 'api-docs', label: 'API Docs', icon: <BookOpen className="w-4 h-4" /> },
      { id: 'api-versions', label: 'API Versions & Diff', icon: <History className="w-4 h-4" /> },
      { id: 'dependencies', label: 'Dependency Graph', icon: <GitFork className="w-4 h-4" /> },
    ],
  },
  {
    id: 'testing',
    label: 'Testing',
    items: [
      { id: 'runner', label: 'Collection Runner', icon: <PlayCircle className="w-4 h-4" /> },
      { id: 'performance', label: 'Performance Testing', icon: <Activity className="w-4 h-4" /> },
      { id: 'security-audit', label: 'Security Audit', icon: <ShieldAlert className="w-4 h-4" /> },
      { id: 'contract-tests', label: 'Contract Testing', icon: <ShieldCheck className="w-4 h-4" /> },
      { id: 'suites', label: 'Test Suites', icon: <FlaskConical className="w-4 h-4" /> },
      { id: 'reports', label: 'Test Reports', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'schemas', label: 'JSON Schemas', icon: <FileJson className="w-4 h-4" /> },
    ],
  },
  {
    id: 'mocking',
    label: 'Mocking',
    items: [{ id: 'mock-servers', label: 'Mock Servers', icon: <Server className="w-4 h-4" /> }],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    items: [
      { id: 'monitors', label: 'API Monitoring', icon: <HeartPulse className="w-4 h-4" /> },
      { id: 'observability', label: 'Observability & Traces', icon: <Eye className="w-4 h-4" /> },
      { id: 'analytics', label: 'Analytics & Reports', icon: <BarChart2 className="w-4 h-4" /> },
    ],
  },
  {
    id: 'dev-tools',
    label: 'Developer Tools',
    items: [
      { id: 'db-tools', label: 'Database Tools', icon: <Database className="w-4 h-4" /> },
      { id: 'git', label: 'Git Client', icon: <GitBranch className="w-4 h-4" /> },
      { id: 'comparison', label: 'Response Diff', icon: <GitCompare className="w-4 h-4" /> },
      { id: 'templates', label: 'Script Templates', icon: <FileCode2 className="w-4 h-4" /> },
      { id: 'devtools', label: 'Developer Tools', icon: <Wrench className="w-4 h-4" /> },
    ],
  },
  {
    id: 'devops',
    label: 'DevOps',
    items: [
      { id: 'workflows', label: 'Automation Workflows', icon: <Workflow className="w-4 h-4" /> },
      { id: 'cicd', label: 'CI/CD Integration', icon: <GitCommitHorizontal className="w-4 h-4" /> },
      { id: 'cli', label: 'API CLI', icon: <Terminal className="w-4 h-4" /> },
    ],
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    items: [{ id: 'workspaces', label: 'Workspaces & Team', icon: <Building2 className="w-4 h-4" /> }],
  },
];

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, setSettingsOpen } = useAppStore();
  const { sidebarWidth, setSidebarWidth, isSidebarCollapsed, toggleSidebar } = useUiStore();
  const { collections } = useCollectionStore();
  const { loadFromCollection } = useRunnerStore();

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(sidebarWidth);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        setSidebarWidth(startWidthRef.current + delta);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [sidebarWidth, setSidebarWidth]
  );

  const handleSelectNav = (id: SidebarSection) => {
    setActiveView(id);
    if (id === 'runner' && collections.length > 0) {
      const currentColId = useRunnerStore.getState().config.collectionId;
      if (!currentColId) {
        loadFromCollection(collections[0].id);
      }
    }
    if (isSidebarCollapsed && (id === 'collections' || id === 'history' || id === 'environments')) {
      toggleSidebar();
    }
  };

  const isDrawerView =
    activeView === 'collections' || activeView === 'history' || activeView === 'environments';

  return (
    <aside className="relative flex h-full select-none shrink-0 z-20">
      {/* 1. Left Grouped Icon Rail */}
      <div className="w-12 h-full flex flex-col items-center justify-between py-2.5 border-r border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 bg-[#0d1017] dark:bg-[#0d1017] light:bg-slate-50/90 backdrop-blur-xl shrink-0 z-10 overflow-y-auto">
        <div className="flex flex-col items-center gap-1 w-full px-1">
          {NAV_GROUPS.map((group, groupIdx) => {
            const groupClosed = !!collapsedGroups[group.id];
            const hasActiveInGroup = group.items.some((i) => i.id === activeView);
            return (
              <div key={group.id} className="w-full flex flex-col items-center">
                {groupIdx > 0 && <div className="w-6 h-px bg-slate-800/80 my-1" />}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  title={`${group.label} (${groupClosed ? 'Expand' : 'Collapse'})`}
                  className={`w-full flex items-center justify-center py-0.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer rounded transition-colors ${
                    hasActiveInGroup ? 'text-cyan-400' : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {groupClosed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                {!groupClosed &&
                  group.items.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectNav(item.id)}
                        title={`${group.label}: ${item.label}`}
                        className={`relative p-1.5 rounded-xl transition-all cursor-pointer group ${
                          isActive
                            ? 'bg-blue-600/20 text-cyan-400 border border-blue-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        {item.icon}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>

        {/* Bottom Rail items: collapse toggle & settings */}
        <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-slate-800/70 w-full">
          <button
            type="button"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-cyan-400" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Side Drawer Pane (for Collections / History / Environments) */}
      {!isSidebarCollapsed && isDrawerView && (
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="h-full flex flex-col border-r border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 bg-[#121620]/90 dark:bg-[#121620]/90 light:bg-white/80 backdrop-blur-xl overflow-hidden transition-width duration-75"
        >
          {activeView === 'collections' && <CollectionTree />}
          {activeView === 'history' && <HistoryPage isSidebarView />}
          {activeView === 'environments' && <EnvironmentManager isSidebarView />}
        </div>
      )}

      {/* 3. Drag handle for resizing */}
      {!isSidebarCollapsed && isDrawerView && (
        <div
          onMouseDown={startResizing}
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-cyan-500/50 transition-colors z-30 ${
            isResizing ? 'bg-cyan-400' : ''
          }`}
          title="Drag to resize sidebar width"
        />
      )}
    </aside>
  );
};

