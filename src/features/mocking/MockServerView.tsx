import React, { useMemo, useState } from 'react';
import {
  Server,
  Play,
  Square,
  RotateCw,
  Plus,
  Trash2,
  Sparkles,
  Send,
  AlertTriangle,
  Download,
  Eraser,
} from 'lucide-react';
import { useMockStore } from '../../stores/mockStore';
import { useSpecStore } from '../../stores/specStore';
import { useDesktopStore } from '../../stores/desktopStore';
import { HttpMethod } from '../../types';

export const MockServerView: React.FC = () => {
  const {
    servers,
    statuses,
    logs,
    activeServerId,
    lastError,
    selectServer,
    createServer,
    updateServerConfig,
    deleteServer,
    addEndpointRule,
    updateEndpointRule,
    deleteEndpointRule,
    generateFromOpenApi,
    startServer,
    stopServer,
    restartServer,
    simulateTestCall,
    clearLogs,
  } = useMockStore();
  const { specs } = useSpecStore();
  const { capabilities } = useDesktopStore();

  const activeServer = servers.find((s) => s.id === activeServerId) || null;
  const activeStatus = activeServer ? statuses[activeServer.id] : undefined;
  const serverLogs = useMemo(
    () => logs.filter((l) => l.serverId === activeServerId),
    [logs, activeServerId]
  );

  const [newServerName, setNewServerName] = useState('');
  const [newServerPort, setNewServerPort] = useState('4011');
  const [selectedSpecForGen, setSelectedSpecForGen] = useState(specs[0]?.id || '');

  // In-app route simulator
  const [simMethod, setSimMethod] = useState<HttpMethod>('GET');
  const [simPath, setSimPath] = useState('/users/42');
  const [simResult, setSimResult] = useState<{ status: number; body: string } | null>(null);

  const handleCreateServer = async () => {
    await createServer({
      name: newServerName.trim() || `Mock Server ${servers.length + 1}`,
      port: Number(newServerPort) || 4011,
    });
    setNewServerName('');
  };

  const handleGenerateFromSpec = async () => {
    if (!activeServer) return;
    const targetSpec = specs.find((s) => s.id === (selectedSpecForGen || specs[0]?.id));
    if (!targetSpec) return;
    await generateFromOpenApi(activeServer.id, targetSpec.content);
  };

  const handleRunSimulator = async () => {
    if (!activeServer) return;
    const res = await simulateTestCall(activeServer.id, simMethod, simPath);
    setSimResult({ status: res.status, body: res.body });
  };

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(serverLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mock-logs-${activeServer?.name || 'server'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d111a] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Server className="w-4 h-4 text-amber-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Native API Mocking Server Studio</h1>
            <p className="text-[11px] text-slate-400">
              {capabilities.isDesktop
                ? 'Powered by native Rust Axum HTTP listener (localhost-first binding by default).'
                : 'Browser mode: configure endpoints, generate OpenAPI mocks, and test with the In-App Simulator. Real port binding runs in Tauri Desktop.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <input
            type="text"
            value={newServerName}
            onChange={(e) => setNewServerName(e.target.value)}
            placeholder="New mock server..."
            className="w-36 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
          />
          <input
            type="number"
            value={newServerPort}
            onChange={(e) => setNewServerPort(e.target.value)}
            className="w-20 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-slate-200"
          />
          <button
            type="button"
            onClick={handleCreateServer}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Server</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Server List */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#10141f] p-3 space-y-2 overflow-y-auto shrink-0">
          {servers.map((srv) => {
            const running = statuses[srv.id]?.running;
            return (
              <div
                key={srv.id}
                onClick={() => selectServer(srv.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                  activeServerId === srv.id
                    ? 'bg-blue-950/30 border-cyan-500/40'
                    : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100 truncate">{srv.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      running ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-slate-600'
                    }`}
                  />
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {srv.host}:{srv.port} · {srv.endpoints.length} routes
                </div>
              </div>
            );
          })}
        </aside>

        {/* Main Detail Pane */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!activeServer ? (
            <div className="py-20 text-center text-xs text-slate-500">
              Select or create a mock server to configure endpoints.
            </div>
          ) : (
            <>
              {/* Server Lifecycle & Security Controls */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 mr-1.5">Bind Port:</span>
                      <input
                        type="number"
                        value={activeServer.port}
                        onChange={(e) =>
                          updateServerConfig(activeServer.id, { port: Number(e.target.value) || 4010 })
                        }
                        className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-cyan-300"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={activeServer.allowLanExposure}
                        onChange={(e) =>
                          updateServerConfig(activeServer.id, {
                            allowLanExposure: e.target.checked,
                          })
                        }
                        className="rounded border-slate-700"
                      />
                      <span>Expose on LAN (0.0.0.0)</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    {!activeStatus?.running ? (
                      <button
                        type="button"
                        onClick={() => startServer(activeServer.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Native Server</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => restartServer(activeServer.id)}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-medium text-white flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Restart</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => stopServer(activeServer.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-medium text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Stop</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteServer(activeServer.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 cursor-pointer"
                      title="Delete Mock Server"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {activeServer.allowLanExposure && (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      LAN Exposure Warning: binding to 0.0.0.0 makes this mock server reachable from your local network. Uncheck to restrict to 127.0.0.1.
                    </span>
                  </div>
                )}

                {lastError && (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300">
                    {lastError}
                  </div>
                )}

                {/* OpenAPI-to-Mock Generator Strip */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 text-xs">
                  <select
                    value={selectedSpecForGen || specs[0]?.id || ''}
                    onChange={(e) => setSelectedSpecForGen(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                  >
                    {specs.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name} (v{sp.version})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={specs.length === 0}
                    onClick={handleGenerateFromSpec}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Routes from OpenAPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addEndpointRule(activeServer.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Endpoint</span>
                  </button>
                </div>
              </div>

              {/* Endpoint Rules List */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Mock Endpoints ({activeServer.endpoints.length})
                </h3>
                {activeServer.endpoints.map((ep) => (
                  <div
                    key={ep.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={ep.enabled}
                        onChange={(e) =>
                          updateEndpointRule(activeServer.id, ep.id, { enabled: e.target.checked })
                        }
                      />
                      <select
                        value={ep.method}
                        onChange={(e) =>
                          updateEndpointRule(activeServer.id, ep.id, {
                            method: e.target.value as HttpMethod,
                          })
                        }
                        className="px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-cyan-300"
                      >
                        {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as HttpMethod[]).map(
                          (m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          )
                        )}
                      </select>
                      <input
                        type="text"
                        value={ep.path}
                        onChange={(e) =>
                          updateEndpointRule(activeServer.id, ep.id, { path: e.target.value })
                        }
                        className="flex-1 min-w-[160px] px-2.5 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-slate-100"
                      />
                      <span className="text-slate-400">Status</span>
                      <input
                        type="number"
                        value={ep.statusCode}
                        onChange={(e) =>
                          updateEndpointRule(activeServer.id, ep.id, {
                            statusCode: Number(e.target.value) || 200,
                          })
                        }
                        className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-emerald-300"
                      />
                      <span className="text-slate-400">Delay(ms)</span>
                      <input
                        type="number"
                        value={ep.delayMs}
                        onChange={(e) =>
                          updateEndpointRule(activeServer.id, ep.id, {
                            delayMs: Number(e.target.value) || 0,
                          })
                        }
                        className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => deleteEndpointRule(activeServer.id, ep.id)}
                        className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      value={ep.body}
                      onChange={(e) =>
                        updateEndpointRule(activeServer.id, ep.id, { body: e.target.value })
                      }
                      placeholder='Supports safe templates: {{path.id}}, {{query.name}}, {{$uuid}}, {{$timestamp}}, {{$isoTimestamp}}'
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300"
                    />
                  </div>
                ))}
              </div>

              {/* In-App Simulator & Captured Logs */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
                  <h3 className="font-semibold text-slate-200">In-App Route Test Simulator</h3>
                  <div className="flex gap-2">
                    <select
                      value={simMethod}
                      onChange={(e) => setSimMethod(e.target.value as HttpMethod)}
                      className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    <input
                      type="text"
                      value={simPath}
                      onChange={(e) => setSimPath(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono text-cyan-300"
                    />
                    <button
                      type="button"
                      onClick={handleRunSimulator}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Test</span>
                    </button>
                  </div>
                  {simResult && (
                    <div className="space-y-1">
                      <div className="font-mono text-emerald-400">HTTP {simResult.status}</div>
                      <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] overflow-x-auto max-h-40">
                        {simResult.body}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-200">
                      Captured Request Logs ({serverLogs.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportLogs}
                        className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => clearLogs(activeServer.id)}
                        className="text-slate-400 hover:text-red-400 flex items-center gap-1 cursor-pointer"
                      >
                        <Eraser className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {serverLogs.length === 0 ? (
                      <div className="py-6 text-center text-slate-500">No requests logged yet.</div>
                    ) : (
                      serverLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-[11px]"
                        >
                          <div className="truncate">
                            <span className="text-cyan-300 font-bold mr-2">{log.method}</span>
                            <span className="text-slate-200">{log.path}</span>
                          </div>
                          <span
                            className={
                              log.responseStatus >= 400 ? 'text-amber-400' : 'text-emerald-400'
                            }
                          >
                            {log.responseStatus} · {log.responseTimeMs}ms
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
