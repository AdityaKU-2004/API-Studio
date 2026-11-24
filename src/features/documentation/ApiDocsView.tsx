import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  Copy,
  Check,
  Search,
  Sun,
  Moon,
  Monitor,
  FileText,
  FileCode2,
} from 'lucide-react';
import { useSpecStore } from '../../stores/specStore';
import {
  buildEndpointCurlExample,
  generateHtmlDocumentation,
  generateMarkdownDocumentation,
  generatePdfDocumentationBlob,
} from '../../services/documentation/docGenerator';
import { DocThemeMode, HttpMethod } from '../../types';
import { MethodBadge } from '../../components/common/MethodBadge';

export const ApiDocsView: React.FC = () => {
  const { specs, activeSpecId, parsedDoc, selectSpec } = useSpecStore();
  const [docTheme, setDocTheme] = useState<DocThemeMode>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredEndpoints = useMemo(() => {
    if (!parsedDoc) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return parsedDoc.endpoints;
    return parsedDoc.endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(q) ||
        (ep.summary || '').toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q)
    );
  }, [parsedDoc, searchQuery]);

  const effectiveLight =
    docTheme === 'light' ||
    (docTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: light)').matches);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = () => {
    if (!parsedDoc) return;
    const html = generateHtmlDocumentation(parsedDoc, docTheme);
    triggerDownload(
      new Blob([html], { type: 'text/html;charset=utf-8' }),
      `${parsedDoc.title.toLowerCase().replace(/\s+/g, '-')}-docs.html`
    );
  };

  const handleExportMarkdown = () => {
    if (!parsedDoc) return;
    const md = generateMarkdownDocumentation(parsedDoc);
    triggerDownload(
      new Blob([md], { type: 'text/markdown;charset=utf-8' }),
      `${parsedDoc.title.toLowerCase().replace(/\s+/g, '-')}-docs.md`
    );
  };

  const handleExportPdf = () => {
    if (!parsedDoc) return;
    const pdfBlob = generatePdfDocumentationBlob(parsedDoc);
    triggerDownload(
      pdfBlob,
      `${parsedDoc.title.toLowerCase().replace(/\s+/g, '-')}-docs.pdf`
    );
  };

  const baseUrl = parsedDoc?.servers[0]?.url || 'https://api.example.com';

  return (
    <div className="h-full flex flex-col bg-[#0d111a] text-slate-200 overflow-hidden">
      {/* Header Toolbar */}
      <div className="px-5 py-3 border-b border-slate-800 bg-[#111622] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-100">Interactive API Documentation</span>
          <select
            value={activeSpecId || ''}
            onChange={(e) => selectSpec(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
          >
            {specs.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} (v{sp.version})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preview Theme Toggle */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDocTheme('dark')}
              title="Dark preview"
              className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer ${
                docTheme === 'dark' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'
              }`}
            >
              <Moon className="w-3 h-3" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setDocTheme('light')}
              title="Light preview"
              className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer ${
                docTheme === 'light' ? 'bg-slate-800 text-amber-300' : 'text-slate-400'
              }`}
            >
              <Sun className="w-3 h-3" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => setDocTheme('system')}
              title="System preference"
              className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer ${
                docTheme === 'system' ? 'bg-slate-800 text-blue-300' : 'text-slate-400'
              }`}
            >
              <Monitor className="w-3 h-3" />
              <span>System</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!parsedDoc}
            onClick={handleExportHtml}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export HTML</span>
          </button>
          <button
            type="button"
            disabled={!parsedDoc}
            onClick={handleExportMarkdown}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Markdown</span>
          </button>
          <button
            type="button"
            disabled={!parsedDoc}
            onClick={handleExportPdf}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Interactive Viewer Body */}
      {!parsedDoc ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
          Select or import a valid OpenAPI specification to render documentation.
        </div>
      ) : (
        <div
          className={`flex-1 flex overflow-hidden transition-colors ${
            effectiveLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0b0f17] text-slate-200'
          }`}
        >
          {/* Docs Sidebar Navigation */}
          <aside
            className={`w-64 shrink-0 border-r overflow-y-auto p-3 space-y-3 ${
              effectiveLight ? 'bg-white border-slate-200' : 'bg-[#101522] border-slate-800'
            }`}
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter endpoints..."
                className={`w-full pl-8 pr-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                  effectiveLight
                    ? 'bg-slate-100 border-slate-300 text-slate-900'
                    : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}
              />
            </div>

            <div className="space-y-1">
              {filteredEndpoints.map((ep) => (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    setSelectedEndpointId(ep.id);
                    document.getElementById(`doc-ep-${ep.id}`)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                    selectedEndpointId === ep.id
                      ? 'bg-cyan-500/15 text-cyan-400 font-medium'
                      : effectiveLight
                        ? 'hover:bg-slate-100 text-slate-700'
                        : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <MethodBadge method={ep.method as HttpMethod} size="sm" />
                  <span className="truncate font-mono text-[11px]">{ep.path}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Main Documentation Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
            <div className="space-y-2 pb-4 border-b border-slate-700/30">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{parsedDoc.title}</h1>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 text-xs font-mono">
                  v{parsedDoc.version}
                </span>
              </div>
              {parsedDoc.description && (
                <p className={effectiveLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>
                  {parsedDoc.description}
                </p>
              )}
              {parsedDoc.servers.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {parsedDoc.servers.map((srv) => (
                    <span
                      key={srv.url}
                      className={`px-2.5 py-1 rounded text-xs font-mono border ${
                        effectiveLight
                          ? 'bg-slate-100 border-slate-300 text-slate-800'
                          : 'bg-slate-900 border-slate-800 text-cyan-300'
                      }`}
                    >
                      {srv.url}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {filteredEndpoints.map((ep) => {
              const curl = buildEndpointCurlExample(ep, baseUrl);
              return (
                <section
                  key={ep.id}
                  id={`doc-ep-${ep.id}`}
                  className={`p-5 rounded-xl border space-y-4 ${
                    effectiveLight
                      ? 'bg-white border-slate-200 shadow-sm'
                      : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <MethodBadge method={ep.method as HttpMethod} size="sm" />
                      <code className="text-sm font-mono font-semibold">{ep.path}</code>
                    </div>
                    <span className="text-[11px] text-slate-400">{ep.tags.join(', ')}</span>
                  </div>

                  {ep.summary && <h3 className="text-sm font-semibold">{ep.summary}</h3>}
                  {ep.description && (
                    <p className={effectiveLight ? 'text-xs text-slate-600' : 'text-xs text-slate-400'}>
                      {ep.description}
                    </p>
                  )}

                  {ep.parameters.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className={effectiveLight ? 'bg-slate-100' : 'bg-slate-950/60'}>
                            <th className="p-2 text-left border border-slate-700/30">Parameter</th>
                            <th className="p-2 text-left border border-slate-700/30">In</th>
                            <th className="p-2 text-left border border-slate-700/30">Required</th>
                            <th className="p-2 text-left border border-slate-700/30">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ep.parameters.map((p) => (
                            <tr key={`${p.in}:${p.name}`}>
                              <td className="p-2 border border-slate-700/30 font-mono">{p.name}</td>
                              <td className="p-2 border border-slate-700/30">{p.in}</td>
                              <td className="p-2 border border-slate-700/30">
                                {p.required ? 'Yes' : 'No'}
                              </td>
                              <td className="p-2 border border-slate-700/30 font-mono">
                                {String(p.schema?.type || 'string')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        cURL Example
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(`curl-${ep.id}`, curl)}
                        className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === `curl-${ep.id}` ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === `curl-${ep.id}` ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre
                      className={`p-3 rounded-lg font-mono text-[11px] overflow-x-auto border ${
                        effectiveLight
                          ? 'bg-slate-900 text-slate-100 border-slate-800'
                          : 'bg-slate-950 text-cyan-200 border-slate-800'
                      }`}
                    >
                      {curl}
                    </pre>
                  </div>

                  {ep.requestBody?.exampleJson && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Request Body JSON
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`req-${ep.id}`, ep.requestBody!.exampleJson!)}
                          className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <pre
                        className={`p-3 rounded-lg font-mono text-[11px] overflow-x-auto border ${
                          effectiveLight
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : 'bg-slate-950 text-emerald-300 border-slate-800'
                        }`}
                      >
                        {ep.requestBody.exampleJson}
                      </pre>
                    </div>
                  )}

                  {ep.responses.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Responses
                      </span>
                      {ep.responses.map((r) => (
                        <div
                          key={r.statusCode}
                          className={`p-2.5 rounded-lg border text-xs ${
                            effectiveLight
                              ? 'bg-slate-50 border-slate-200'
                              : 'bg-slate-950/70 border-slate-800'
                          }`}
                        >
                          <div className="font-mono font-semibold text-cyan-400">
                            {r.statusCode}{' '}
                            <span className="font-sans font-normal text-slate-400">
                              — {r.description}
                            </span>
                          </div>
                          {r.exampleJson && (
                            <pre className="mt-1.5 font-mono text-[11px] overflow-x-auto">
                              {r.exampleJson}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
