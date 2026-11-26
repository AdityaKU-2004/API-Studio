import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Folder,
  Clock,
  Layers,
  CornerDownLeft,
  GitCompare,
  Wrench,
  Cpu,
  Server,
  ShieldCheck,
  Building2,
  BookOpen,
  FileEdit,
  GitBranch,
  History,
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
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useHistoryStore } from '../../stores/historyStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useSpecStore } from '../../stores/specStore';
import { useMockStore } from '../../stores/mockStore';
import { useContractStore } from '../../stores/contractStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { parseOpenApiDocument } from '../../services/openapi/openapiParser';
import { MethodBadge } from './MethodBadge';
import { ApiRequest, SidebarSection } from '../../types';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category:
    | 'request'
    | 'collection'
    | 'history'
    | 'environment'
    | 'spec'
    | 'endpoint'
    | 'mock'
    | 'report'
    | 'workspace';
  method?: string;
  request?: ApiRequest;
  environmentId?: string;
  specId?: string;
  mockServerId?: string;
  reportId?: string;
  workspaceId?: string;
  targetView?: SidebarSection;
}

export const SearchDialog: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setActiveView } = useAppStore();
  const { collections } = useCollectionStore();
  const { openRequestInTab } = useRequestStore();
  const { history } = useHistoryStore();
  const { environments, setActiveEnvironmentId } = useEnvironmentStore();
  const { specs, selectSpec } = useSpecStore();
  const { servers, selectServer } = useMockStore();
  const { reports, selectReport } = useContractStore();
  const { workspaces, setActiveWorkspace } = useWorkspaceStore();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 80);
    return () => clearTimeout(t);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Global keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  const results: SearchResultItem[] = useMemo(() => {
    const items: SearchResultItem[] = [];
    const q = debouncedQuery.toLowerCase().trim();

    // 1. Collections & Requests
    const traverse = (cols: typeof collections, parentPath = '') => {
      for (const item of cols) {
        const fullPath = parentPath ? `${parentPath} / ${item.name}` : item.name;

        if (item.type === 'collection') {
          if (!q || item.name.toLowerCase().includes(q)) {
            items.push({
              id: 'col-' + item.id,
              title: item.name,
              subtitle: item.description || 'Collection',
              category: 'collection',
            });
          }
          if (item.children) traverse(item.children, fullPath);
        } else if (item.type === 'folder') {
          if (!q || item.name.toLowerCase().includes(q)) {
            items.push({
              id: 'fld-' + item.id,
              title: item.name,
              subtitle: `Folder in ${parentPath}`,
              category: 'collection',
            });
          }
          if (item.children) traverse(item.children, fullPath);
        } else if (item.type === 'request' && item.request) {
          if (
            !q ||
            item.name.toLowerCase().includes(q) ||
            item.request.url.toLowerCase().includes(q) ||
            item.request.method.toLowerCase().includes(q)
          ) {
            items.push({
              id: 'req-' + item.id,
              title: item.name,
              subtitle: `${item.request.url} · ${parentPath}`,
              category: 'request',
              method: item.request.method,
              request: item.request,
            });
          }
        }
      }
    };
    traverse(collections);

    // 2. OpenAPI Specs & Parsed Endpoints
    for (const sp of specs) {
      if (!q || sp.name.toLowerCase().includes(q) || sp.version.toLowerCase().includes(q)) {
        items.push({
          id: 'spec-' + sp.id,
          title: sp.name,
          subtitle: `OpenAPI ${sp.format.toUpperCase()} · v${sp.version}`,
          category: 'spec',
          specId: sp.id,
          targetView: 'apis',
        });
      }
      try {
        const parsed = parseOpenApiDocument(sp.content);
        for (const ep of parsed.endpoints.slice(0, 40)) {
          if (
            !q ||
            ep.path.toLowerCase().includes(q) ||
            ep.method.toLowerCase().includes(q) ||
            (ep.summary || '').toLowerCase().includes(q)
          ) {
            items.push({
              id: `ep-${sp.id}-${ep.id}`,
              title: ep.summary || `${ep.method} ${ep.path}`,
              subtitle: `${ep.path} · Spec: ${sp.name}`,
              category: 'endpoint',
              method: ep.method,
              specId: sp.id,
              targetView: 'apis',
            });
          }
        }
      } catch {
        // Ignore unparseable spec draft during search indexing
      }
    }

    // 3. Mock Servers
    for (const srv of servers) {
      if (!q || srv.name.toLowerCase().includes(q) || String(srv.port).includes(q)) {
        items.push({
          id: 'mock-' + srv.id,
          title: srv.name,
          subtitle: `${srv.host}:${srv.port} · ${srv.endpoints.length} mock routes`,
          category: 'mock',
          mockServerId: srv.id,
          targetView: 'mock-servers',
        });
      }
    }

    // 4. Contract Reports
    for (const rep of reports.slice(0, 6)) {
      if (!q || rep.specName.toLowerCase().includes(q) || rep.baseUrl.toLowerCase().includes(q)) {
        items.push({
          id: 'rep-' + rep.id,
          title: `Contract Report: ${rep.specName}`,
          subtitle: `${rep.passedCount}/${rep.totalEndpoints} passed · ${rep.baseUrl}`,
          category: 'report',
          reportId: rep.id,
          targetView: 'contract-tests',
        });
      }
    }

    // 5. Workspaces
    for (const ws of workspaces) {
      if (!q || ws.name.toLowerCase().includes(q)) {
        items.push({
          id: 'p8ws-' + ws.id,
          title: `Switch to Workspace: ${ws.name}`,
          subtitle: `${ws.type} Workspace · ${ws.description || ''}`,
          category: 'workspace',
          workspaceId: ws.id,
          targetView: 'workspaces',
        });
      }
    }

    // 6. Environments
    for (const env of environments) {
      if (!q || env.name.toLowerCase().includes(q)) {
        items.push({
          id: 'env-' + env.id,
          title: env.name,
          subtitle: `${env.variables.length} environment variables defined`,
          category: 'environment',
          environmentId: env.id,
        });
      }
    }

    // 7. History
    for (const hist of history.slice(0, 8)) {
      if (!q || hist.url.toLowerCase().includes(q) || hist.method.toLowerCase().includes(q)) {
        items.push({
          id: 'hist-' + hist.id,
          title: hist.url,
          subtitle: `Status: ${hist.status} · Time: ${hist.timeMs}ms · ${new Date(hist.timestamp).toLocaleTimeString()}`,
          category: 'history',
          method: hist.method,
          request: hist.request,
        });
      }
    }

    // 8. Studio Views & Quick Commands
    const views: Array<{ id: string; title: string; subtitle: string; targetView: SidebarSection }> = [
      { id: 'view-apis', title: 'API Explorer (OpenAPI)', subtitle: 'Import specs, browse grouped endpoints, generate requests', targetView: 'apis' },
      { id: 'view-spec-editor', title: 'OpenAPI YAML/JSON Spec Editor', subtitle: 'Monaco editor with live schema diagnostics', targetView: 'spec-editor' },
      { id: 'view-docs', title: 'Interactive API Documentation', subtitle: 'Preview docs and export Markdown / HTML / PDF', targetView: 'api-docs' },
      { id: 'view-versions', title: 'API Versions & Breaking Change Diff', subtitle: 'Manage version snapshots and rule-based diffs', targetView: 'api-versions' },
      { id: 'view-contract', title: 'Contract Testing Runner', subtitle: 'Validate live HTTP responses against OpenAPI schemas', targetView: 'contract-tests' },
      { id: 'view-mocks', title: 'Mock Server Studio', subtitle: 'Localhost Axum mock servers & in-app route tester', targetView: 'mock-servers' },
      { id: 'view-git', title: 'Git Client (libgit2)', subtitle: 'Branches, staging, secret scan, diff & commits', targetView: 'git' },
      { id: 'view-ws', title: 'Workspace & Project Dashboard', subtitle: 'Manage projects, team RBAC roles, comments & ZIP export', targetView: 'workspaces' },
      { id: 'ws-comparison', title: 'Response Comparison', subtitle: 'Diff two HTTP responses (JSON, text, and headers)', targetView: 'comparison' },
      { id: 'ws-devtools', title: 'Developer Tools & SSL Inspector', subtitle: 'JSON Formatter, JSON-to-TS, JWT, Base64, Hash, UUID, Regex, SSL', targetView: 'devtools' },
      { id: 'cmd-perf', title: 'Run Performance Test', subtitle: 'Bounded concurrency load testing & latency percentiles', targetView: 'performance' },
      { id: 'cmd-sec', title: 'Run Security Audit', subtitle: 'Passive HTTPS/TLS/Headers, exposure & OpenAPI security scan', targetView: 'security-audit' },
      { id: 'cmd-mon', title: 'Open Monitoring', subtitle: 'Automated health checks, uptime & webhook alerts', targetView: 'monitors' },
      { id: 'cmd-obs', title: 'Open Observability', subtitle: 'Trace correlation, DNS/TCP/TLS timing & header redaction', targetView: 'observability' },
      { id: 'cmd-db', title: 'Open Database Tools', subtitle: 'SQLite / PostgreSQL / MySQL schema explorer & SQL runner', targetView: 'db-tools' },
      { id: 'cmd-dep', title: 'Open Dependency Graph', subtitle: 'Interactive structural graph & Mermaid export', targetView: 'dependencies' },
      { id: 'cmd-wf', title: 'Open Workflows', subtitle: 'Sequential API automation workflow builder', targetView: 'workflows' },
      { id: 'cmd-cicd', title: 'Open CI/CD Generator', subtitle: 'GitHub Actions, GitLab CI, Jenkins & POSIX shell pipelines', targetView: 'cicd' },
      { id: 'cmd-cli', title: 'Open CLI Configuration', subtitle: 'Headless api-studio CLI command builder & exit codes', targetView: 'cli' },
      { id: 'cmd-ana', title: 'Open Analytics Dashboard', subtitle: 'Unified metrics dashboard & Report Center', targetView: 'analytics' },
    ];
    for (const v of views) {
      if (!q || v.title.toLowerCase().includes(q) || v.subtitle.toLowerCase().includes(q)) {
        items.push({
          id: v.id,
          title: v.title,
          subtitle: v.subtitle,
          category: 'workspace',
          targetView: v.targetView,
        });
      }
    }

    return items.slice(0, 20);
  }, [collections, specs, servers, reports, workspaces, environments, history, debouncedQuery]);

  const handleSelect = (item: SearchResultItem) => {
    if (item.request) {
      openRequestInTab(item.request);
      setActiveView('collections');
    } else if (item.environmentId) {
      setActiveEnvironmentId(item.environmentId);
      setActiveView('environments');
    } else if (item.specId) {
      selectSpec(item.specId);
      setActiveView(item.targetView || 'apis');
    } else if (item.mockServerId) {
      selectServer(item.mockServerId);
      setActiveView('mock-servers');
    } else if (item.reportId) {
      selectReport(item.reportId);
      setActiveView('contract-tests');
    } else if (item.workspaceId) {
      void setActiveWorkspace(item.workspaceId);
      setActiveView('workspaces');
    } else if (item.targetView) {
      setActiveView(item.targetView);
    } else if (item.category === 'collection') {
      setActiveView('collections');
    }
    setCommandPaletteOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  const renderIcon = (item: SearchResultItem) => {
    if (item.method) {
      return (
        <MethodBadge
          method={item.method as any}
          requestType={item.request?.requestType}
          size="sm"
        />
      );
    }
    if (item.targetView === 'comparison') return <GitCompare className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.targetView === 'devtools') return <Wrench className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.targetView === 'apis' || item.category === 'spec') return <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.targetView === 'spec-editor') return <FileEdit className="w-4 h-4 text-blue-400 shrink-0" />;
    if (item.targetView === 'api-docs') return <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />;
    if (item.targetView === 'api-versions') return <History className="w-4 h-4 text-amber-400 shrink-0" />;
    if (item.targetView === 'contract-tests' || item.category === 'report') return <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (item.targetView === 'mock-servers' || item.category === 'mock') return <Server className="w-4 h-4 text-amber-400 shrink-0" />;
    if (item.targetView === 'git') return <GitBranch className="w-4 h-4 text-orange-400 shrink-0" />;
    if (item.targetView === 'performance') return <Activity className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.targetView === 'security-audit') return <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />;
    if (item.targetView === 'monitors') return <HeartPulse className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (item.targetView === 'observability') return <Eye className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.targetView === 'db-tools') return <Database className="w-4 h-4 text-blue-400 shrink-0" />;
    if (item.targetView === 'dependencies') return <GitFork className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.targetView === 'workflows') return <Workflow className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.targetView === 'cicd') return <GitCommitHorizontal className="w-4 h-4 text-blue-400 shrink-0" />;
    if (item.targetView === 'cli') return <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.targetView === 'analytics') return <BarChart2 className="w-4 h-4 text-blue-400 shrink-0" />;
    if (item.targetView === 'workspaces' || item.category === 'workspace') return <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.category === 'collection') return <Folder className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.category === 'environment') return <Layers className="w-4 h-4 text-emerald-400 shrink-0" />;
    return <Clock className="w-4 h-4 text-purple-400 shrink-0" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={() => setCommandPaletteOpen(false)}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-2xl rounded-xl glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 text-slate-100 dark:text-slate-100 light:text-slate-900 border border-blue-500/25 dark:border-blue-500/25 light:border-blue-300 shadow-2xl overflow-hidden z-10"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-700/60 dark:border-slate-800/80 light:border-slate-200">
          <Search className="w-5 h-5 text-cyan-400 dark:text-cyan-400 light:text-blue-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search specs, endpoints, requests, mocks, reports, workspaces..."
            className="w-full bg-transparent text-sm text-slate-100 dark:text-slate-100 light:text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/50 dark:bg-slate-800/50 light:bg-slate-100 border border-slate-700/60 dark:border-slate-700/60 light:border-slate-300 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No matching requests or resources found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                      : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {renderIcon(item)}

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
                    <span className="capitalize">{item.category}</span>
                    {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="font-mono text-cyan-400">API Studio Global Search</span>
        </div>
      </div>
    </div>
  );
};

