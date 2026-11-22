import React, { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { KeyValueItem, SseConfig } from '../../types';
import { useRequestStore } from '../../stores/requestStore';
import { useSseStore } from '../../stores/sseStore';
import { createDefaultSseConfig } from '../../services/request/protocolRequestFactory';
import { SaveRequestAsModal } from '../../components/request/SaveRequestAsModal';
import { SseConnectionBar } from './SseConnectionBar';
import { SseEventViewer } from './SseEventViewer';

export const SseWorkspace: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest, saveActiveRequest } = useRequestStore();
  const { sessionsByTabId, connect, disconnect, togglePause, clearEvents } = useSseStore();

  const [showSettings, setShowSettings] = useState(false);
  const [configTab, setConfigTab] = useState<'headers' | 'auth'>('headers');
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const sseConfig: SseConfig = useMemo(
    () => request?.sse || createDefaultSseConfig(request?.url),
    [request]
  );

  const session = sessionsByTabId[activeTabId] || {
    tabId: activeTabId,
    status: 'disconnected' as const,
    reconnectAttempt: 0,
    isPaused: false,
    events: [],
    bufferedCount: 0,
    totalEventCount: 0,
  };

  if (!request) return null;

  const updateSseConfig = (updates: Partial<SseConfig>) => {
    const nextCfg: SseConfig = { ...sseConfig, ...updates };
    updateActiveRequest({
      sse: nextCfg,
      ...(updates.url !== undefined ? { url: updates.url } : {}),
    });
  };

  const addSseHeader = () => {
    const next: KeyValueItem[] = [
      ...(sseConfig.headers || []),
      { id: 'sse-h-' + Date.now(), key: '', value: '', enabled: true },
    ];
    updateSseConfig({ headers: next });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <SseConnectionBar
        config={sseConfig}
        status={session.status}
        activeTransport={session.activeTransport}
        reconnectStrategy={session.reconnectStrategy}
        reconnectAttempt={session.reconnectAttempt}
        errorMessage={session.errorMessage}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((s) => !s)}
        onUpdateConfig={updateSseConfig}
        onConnect={() => connect(activeTabId, request)}
        onDisconnect={() => disconnect(activeTabId, request)}
        onSave={() => (request.collectionId ? saveActiveRequest() : setIsSaveAsOpen(true))}
      />

      {/* Optional Custom Headers & Auth Drawer (used in Fetch Stream / Auto modes) */}
      {showSettings && (
        <div className="border-b border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs space-y-2 shrink-0">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-1.5">
            <button
              type="button"
              onClick={() => setConfigTab('headers')}
              className={`font-medium cursor-pointer ${
                configTab === 'headers' ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              Custom Headers (Fetch Mode)
            </button>
            <button
              type="button"
              onClick={() => setConfigTab('auth')}
              className={`font-medium cursor-pointer ${
                configTab === 'auth' ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              Authentication (Fetch Mode)
            </button>
          </div>

          {configTab === 'headers' ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {(sseConfig.headers || []).map((h, idx) => (
                <div key={h.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={(e) => {
                      const next = [...sseConfig.headers];
                      next[idx] = { ...h, enabled: e.target.checked };
                      updateSseConfig({ headers: next });
                    }}
                  />
                  <input
                    type="text"
                    value={h.key}
                    onChange={(e) => {
                      const next = [...sseConfig.headers];
                      next[idx] = { ...h, key: e.target.value };
                      updateSseConfig({ headers: next });
                    }}
                    placeholder="Header name"
                    className="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200"
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => {
                      const next = [...sseConfig.headers];
                      next[idx] = { ...h, value: e.target.value };
                      updateSseConfig({ headers: next });
                    }}
                    placeholder="Value or {{variable}}"
                    className="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateSseConfig({
                        headers: sseConfig.headers.filter((item) => item.id !== h.id),
                      })
                    }
                    className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSseHeader}
                className="text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Header</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={sseConfig.auth?.type || 'none'}
                onChange={(e) => {
                  const type = e.target.value as 'none' | 'bearer';
                  updateSseConfig({
                    auth:
                      type === 'bearer'
                        ? { type: 'bearer', bearer: { token: '', prefix: 'Bearer' } }
                        : { type: 'none' },
                  });
                }}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200"
              >
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
              </select>

              {sseConfig.auth?.type === 'bearer' && (
                <input
                  type="password"
                  value={sseConfig.auth.bearer?.token || ''}
                  onChange={(e) =>
                    updateSseConfig({
                      auth: {
                        type: 'bearer',
                        bearer: {
                          prefix: sseConfig.auth?.bearer?.prefix || 'Bearer',
                          token: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="Bearer token or {{api_token}}"
                  className="flex-1 min-w-[220px] px-2.5 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Live SSE Event Viewer */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SseEventViewer
          events={session.events}
          totalEventCount={session.totalEventCount}
          bufferedCount={session.bufferedCount}
          isPaused={session.isPaused}
          connectedAt={session.connectedAt}
          lastEventId={session.lastEventId}
          onTogglePause={() => togglePause(activeTabId, sseConfig.historyLimit)}
          onClear={() => clearEvents(activeTabId)}
        />
      </div>

      <SaveRequestAsModal isOpen={isSaveAsOpen} onClose={() => setIsSaveAsOpen(false)} />
    </div>
  );
};
