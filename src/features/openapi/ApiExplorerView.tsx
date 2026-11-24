import React, { useMemo, useState } from 'react';
import {
  Cpu,
  Upload,
  Globe,
  ClipboardPaste,
  Search,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Download,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Sparkles,
  FileCode2,
} from 'lucide-react';
import { useSpecStore } from '../../stores/specStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useAppStore } from '../../stores/appStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import {
  generateRequestFromEndpoint,
  parseRawSpecObject,
  serializeSpecObject,
} from '../../services/openapi/openapiParser';
import { MethodBadge } from '../../components/common/MethodBadge';
import { HttpMethod, OpenApiEndpointItem } from '../../types';
import { collectionRepository } from '../../repositories/collectionRepository';
import { requestRepository } from '../../repositories/requestRepository';
import { useRequestStore } from '../../stores/requestStore';

export const ApiExplorerView: React.FC = () => {
  const {
    specs,
    activeSpecId,
    parsedDoc,
    validationIssues,
    selectSpec,
    importSpec,
  } = useSpecStore();
  const { collections, loadCollections } = useCollectionStore();
  const { openRequestInTab } = useRequestStore();
  const { setActiveView } = useAppStore();
  const { environments, activeEnvironmentId } = useEnvironmentStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [expandedEndpointIds, setExpandedEndpointIds] = useState<Set<string>>(new Set());

  // Import panel modal/drawer
  const [showImportBox, setShowImportBox] = useState(false);
  const [importMode, setImportMode] = useState<'paste' | 'url' | 'file'>('paste');
  const [importName, setImportName] = useState('');
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Generate collection confirmation modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [targetCollectionId, setTargetCollectionId] = useState<string>('__new__');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [baseUrlOverride, setBaseUrlOverride] = useState('');
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const activeSpec = specs.find((s) => s.id === activeSpecId) || null;

  const activeEnvBaseUrl = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvironmentId);
    const baseVar = env?.variables.find((v) => v.key === 'base_url' || v.key === 'baseUrl');
    return baseVar?.currentValue || baseVar?.initialValue || '';
  }, [environments, activeEnvironmentId]);

  const groupedEndpoints = useMemo(() => {
    if (!parsedDoc) return [];
    const q = searchQuery.toLowerCase().trim();
    const filtered = parsedDoc.endpoints.filter((ep) => {
      if (methodFilter !== 'ALL' && ep.method !== methodFilter) return false;
      if (!q) return true;
      return (
        ep.path.toLowerCase().includes(q) ||
        (ep.summary || '').toLowerCase().includes(q) ||
        (ep.operationId || '').toLowerCase().includes(q) ||
        ep.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    const groups = new Map<string, OpenApiEndpointItem[]>();
    for (const ep of filtered) {
      const tag = ep.tags[0] || 'General';
      const list = groups.get(tag) || [];
      list.push(ep);
      groups.set(tag, list);
    }
    return Array.from(groups.entries());
  }, [parsedDoc, searchQuery, methodFilter]);

  const toggleExpand = (id: string) => {
    setExpandedEndpointIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = String(ev.target?.result || '');
      try {
        setIsImporting(true);
        setImportError(null);
        await importSpec({
          rawContent: content,
          name: file.name.replace(/\.(ya?ml|json)$/i, ''),
          sourceType: 'file',
          sourceLocation: file.name,
        });
        setShowImportBox(false);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse OpenAPI file.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    setImportError(null);
    setIsImporting(true);
    try {
      if (importMode === 'url') {
        if (!importUrl.trim()) throw new Error('Enter a remote OpenAPI JSON or YAML URL.');
        const resp = await fetch(importUrl.trim());
        if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching specification`);
        const rawContent = await resp.text();
        await importSpec({
          rawContent,
          name: importName.trim() || undefined,
          sourceType: 'url',
          sourceLocation: importUrl.trim(),
        });
      } else {
        if (!importText.trim()) throw new Error('Paste OpenAPI 3.0/3.1 or Swagger 2.0 JSON/YAML.');
        await importSpec({
          rawContent: importText,
          name: importName.trim() || undefined,
          sourceType: 'clipboard',
        });
      }
      setShowImportBox(false);
      setImportText('');
      setImportUrl('');
      setImportName('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportSpec = (format: 'json' | 'yaml') => {
    if (!activeSpec) return;
    try {
      const { doc } = parseRawSpecObject(activeSpec.content);
      const output = serializeSpecObject(doc, format);
      const blob = new Blob([output], {
        type: format === 'json' ? 'application/json' : 'application/yaml',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSpec.name.toLowerCase().replace(/\s+/g, '-')}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export specification: ' + (err as Error).message);
    }
  };

  const handleGenerateCollection = async () => {
    if (!parsedDoc) return;
    let colId = targetCollectionId;
    const now = Date.now();
    if (colId === '__new__') {
      colId = await collectionRepository.create({
        id: `col-${now}`,
        name: newCollectionName.trim() || `${parsedDoc.title} (${parsedDoc.version})`,
        description: parsedDoc.description || 'Generated from OpenAPI specification',
        color: 'cyan',
        icon: 'folder',
        order: collections.length + 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    const base = baseUrlOverride.trim() || parsedDoc.servers[0]?.url || activeEnvBaseUrl || '{{base_url}}';
    let createdCount = 0;
    for (let i = 0; i < parsedDoc.endpoints.length; i++) {
      const ep = parsedDoc.endpoints[i];
      const req = generateRequestFromEndpoint(ep, {
        baseUrl: base,
        collectionId: colId,
        parsedDoc,
      });
      req.order = i + 1;
      await requestRepository.create(req);
      createdCount++;
    }

    await loadCollections();
    setShowGenModal(false);
    setGenMessage(`Generated ${createdCount} API requests into collection.`);
  };

  const handleOpenEndpointAsRequest = (ep: OpenApiEndpointItem) => {
    const req = generateRequestFromEndpoint(ep, {
      baseUrl: parsedDoc?.servers[0]?.url || activeEnvBaseUrl || '{{base_url}}',
      parsedDoc: parsedDoc || undefined,
    });
    openRequestInTab(req);
    setActiveView('collections');
  };

  return (
    <div className="h-full flex flex-col bg-[#0d111a] text-slate-200 overflow-hidden">
      {/* Header Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-800/80 bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">API Explorer & OpenAPI Specs</h1>
            <p className="text-[11px] text-slate-400">
              Import OpenAPI 3.0 / 3.1 / Swagger 2.0, inspect schemas, and generate request collections.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeSpecId || ''}
            onChange={(e) => selectSpec(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            {specs.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} (v{sp.version})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowImportBox(!showImportBox)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Spec</span>
          </button>

          {activeSpec && (
            <>
              <button
                type="button"
                onClick={() => setActiveView('spec-editor')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Edit Spec</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCollectionName(
                    parsedDoc ? `${parsedDoc.title} (${parsedDoc.version})` : 'Generated API'
                  );
                  setBaseUrlOverride(parsedDoc?.servers[0]?.url || activeEnvBaseUrl || '{{base_url}}');
                  setShowGenModal(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-1.5 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Generate Collection</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportSpec('yaml')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>YAML</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportSpec('json')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Import Spec Drawer */}
      {showImportBox && (
        <div className="p-4 border-b border-slate-800 bg-slate-900/70 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setImportMode('paste')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
                  importMode === 'paste'
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste YAML / JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('url')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
                  importMode === 'url'
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>From URL</span>
              </button>
              <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Upload File (.yaml / .json)</span>
                <input
                  type="file"
                  accept=".yaml,.yml,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => setShowImportBox(false)}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            placeholder="Optional specification name override..."
            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
          />

          {importMode === 'url' ? (
            <input
              type="text"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
            />
          ) : (
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste OpenAPI 3.0, OpenAPI 3.1, or Swagger 2.0 YAML/JSON..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
            />
          )}

          {importError && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300">
              {importError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isImporting}
              onClick={handleImportSubmit}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
            >
              {isImporting ? 'Importing...' : 'Parse & Import Specification'}
            </button>
          </div>
        </div>
      )}

      {genMessage && (
        <div className="mx-5 mt-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{genMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('collections')}
            className="text-cyan-300 hover:underline font-medium cursor-pointer"
          >
            View in Collections →
          </button>
        </div>
      )}

      {/* Main Explorer Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!parsedDoc ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <Cpu className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-medium text-slate-200">No valid OpenAPI specification loaded</p>
            <p className="text-xs">Import a specification or fix syntax errors in the Spec Editor.</p>
          </div>
        ) : (
          <>
            {/* Overview & Validation Strip */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">{parsedDoc.title}</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono">
                    {parsedDoc.specVersionKind} · v{parsedDoc.version}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {parsedDoc.description || 'No description provided.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400">Endpoints & Schemas</span>
                <div className="text-lg font-bold text-slate-100">
                  {parsedDoc.endpoints.length}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    endpoints · {Object.keys(parsedDoc.schemas).length} schemas
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400">Validation Health</span>
                <div className="flex items-center gap-2 text-xs">
                  {validationIssues.some((i) => i.severity === 'error') ? (
                    <span className="text-red-400 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {validationIssues.filter((i) => i.severity === 'error').length} Errors
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Valid Spec
                    </span>
                  )}
                  <span className="text-amber-400">
                    {validationIssues.filter((i) => i.severity === 'warning').length} Warnings
                  </span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search paths, summaries, tags, or operationId..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
              {(['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethodFilter(m)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono cursor-pointer border ${
                    methodFilter === m
                      ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Tag-Grouped Endpoints */}
            <div className="space-y-4">
              {groupedEndpoints.map(([tag, endpoints]) => (
                <div key={tag} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{tag}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{endpoints.length} ops</span>
                  </div>

                  <div className="divide-y divide-slate-800/70">
                    {endpoints.map((ep) => {
                      const isExpanded = expandedEndpointIds.has(ep.id);
                      return (
                        <div key={ep.id} className="bg-slate-950/30">
                          <div
                            onClick={() => toggleExpand(ep.id)}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/60 cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <MethodBadge method={ep.method as HttpMethod} size="sm" />
                              <span className="font-mono text-xs text-slate-100 truncate">{ep.path}</span>
                              {ep.summary && (
                                <span className="text-xs text-slate-400 truncate hidden sm:inline">
                                  — {ep.summary}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {ep.security && ep.security.length > 0 && (
                                <span title="Authentication required" className="inline-flex">
                                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEndpointAsRequest(ep);
                                }}
                                className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-[11px] text-cyan-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Try Request</span>
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-6 py-3 bg-slate-950/70 border-t border-slate-800/60 space-y-3 text-xs">
                              {ep.description && <p className="text-slate-300">{ep.description}</p>}

                              {ep.parameters.length > 0 && (
                                <div>
                                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">
                                    Parameters
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {ep.parameters.map((p) => (
                                      <div
                                        key={`${p.in}:${p.name}`}
                                        className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between"
                                      >
                                        <div>
                                          <code className="text-cyan-300 font-mono">{p.name}</code>
                                          <span className="text-slate-500 ml-1.5">({p.in})</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          {String(p.schema?.type || 'string')}
                                          {p.required ? ' · required' : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {ep.requestBody?.exampleJson && (
                                <div>
                                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase mb-1">
                                    Request Body Sample
                                  </h4>
                                  <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                                    {ep.requestBody.exampleJson}
                                  </pre>
                                </div>
                              )}

                              <div>
                                <h4 className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">
                                  Responses
                                </h4>
                                <div className="space-y-1.5">
                                  {ep.responses.map((r) => (
                                    <div
                                      key={r.statusCode}
                                      className="p-2 rounded bg-slate-900 border border-slate-800"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-cyan-300">
                                          {r.statusCode}
                                        </span>
                                        <span className="text-slate-300">{r.description}</span>
                                      </div>
                                      {r.exampleJson && (
                                        <pre className="mt-1.5 p-2 rounded bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto">
                                          {r.exampleJson}
                                        </pre>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Generate Collection Confirmation Modal */}
      {showGenModal && parsedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[#121620] border border-blue-500/30 p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">
              Generate Collection from OpenAPI Spec
            </h3>
            <p className="text-xs text-slate-400">
              Creates {parsedDoc.endpoints.length} ready-to-run HTTP requests using server/environment URLs.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Target Collection</label>
                <select
                  value={targetCollectionId}
                  onChange={(e) => setTargetCollectionId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                >
                  <option value="__new__">+ Create New Collection</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      Append to: {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {targetCollectionId === '__new__' && (
                <div>
                  <label className="block text-slate-300 mb-1">New Collection Name</label>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1">Base URL</label>
                <input
                  type="text"
                  value={baseUrlOverride}
                  onChange={(e) => setBaseUrlOverride(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateCollection}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white cursor-pointer"
              >
                Confirm & Generate Requests
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
