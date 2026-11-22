import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { WebSocketConfig } from '../../types';
import { useRequestStore } from '../../stores/requestStore';
import { useWebSocketStore } from '../../stores/websocketStore';
import { useUiStore } from '../../stores/uiStore';
import { createDefaultWebSocketConfig } from '../../services/request/protocolRequestFactory';
import { SaveRequestAsModal } from '../../components/request/SaveRequestAsModal';
import { WebSocketConnectionBar } from './WebSocketConnectionBar';
import { WebSocketComposer } from './WebSocketComposer';
import { WebSocketMessageConsole } from './WebSocketMessageConsole';

export const WebSocketWorkspace: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest, saveActiveRequest } = useRequestStore();
  const { splitRatio, setSplitRatio } = useUiStore();
  const {
    sessionsByTabId,
    templates,
    loadTemplates,
    saveTemplate,
    deleteTemplate,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
  } = useWebSocketStore();

  const [showSettings, setShowSettings] = useState(false);
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (templates.length === 0) {
      void loadTemplates();
    }
  }, [templates.length, loadTemplates]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const wsConfig: WebSocketConfig = useMemo(
    () => request?.websocket || createDefaultWebSocketConfig(request?.url),
    [request]
  );

  const session = sessionsByTabId[activeTabId] || {
    tabId: activeTabId,
    status: 'disconnected' as const,
    reconnectAttempt: 0,
    messages: [],
    sentCount: 0,
    receivedCount: 0,
  };

  const startDragging = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const onMove = (ev: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setSplitRatio(((ev.clientY - rect.top) / rect.height) * 100);
      };
      const onUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [setSplitRatio]
  );

  if (!request) return null;

  const updateWsConfig = (updates: Partial<WebSocketConfig>) => {
    const nextCfg: WebSocketConfig = { ...wsConfig, ...updates };
    updateActiveRequest({
      websocket: nextCfg,
      ...(updates.url !== undefined ? { url: updates.url } : {}),
    });
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top WebSocket Connection & Message Composer */}
      <div style={{ height: `${splitRatio}%` }} className="flex flex-col overflow-hidden">
        <WebSocketConnectionBar
          config={wsConfig}
          status={session.status}
          reconnectAttempt={session.reconnectAttempt}
          errorMessage={session.errorMessage}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings((s) => !s)}
          onUpdateConfig={updateWsConfig}
          onConnect={() => connect(activeTabId, request)}
          onDisconnect={() => disconnect(activeTabId, request)}
          onSave={() => (request.collectionId ? saveActiveRequest() : setIsSaveAsOpen(true))}
        />

        <div className="flex-1 min-h-0 overflow-hidden">
          <WebSocketComposer
            isConnected={session.status === 'connected'}
            templates={templates}
            onSend={(payload, format, bytes) =>
              sendMessage(activeTabId, payload, format, wsConfig, bytes)
            }
            onSaveTemplate={(name, format, payload) => void saveTemplate(name, format, payload)}
            onDeleteTemplate={(id) => void deleteTemplate(id)}
          />
        </div>
      </div>

      {/* Horizontal Split Handle */}
      <div
        onMouseDown={startDragging}
        className={`h-1.5 w-full cursor-row-resize hover:bg-cyan-500/50 transition-colors z-20 flex items-center justify-center shrink-0 ${
          isDragging ? 'bg-cyan-400' : 'bg-slate-800/80'
        }`}
      >
        <div className="w-8 h-0.5 rounded-full bg-slate-500/80" />
      </div>

      {/* Bottom Real-Time Message Console */}
      <div style={{ height: `${100 - splitRatio}%` }} className="w-full overflow-hidden">
        <WebSocketMessageConsole
          messages={session.messages}
          sentCount={session.sentCount}
          receivedCount={session.receivedCount}
          connectedAt={session.connectedAt}
          onClear={() => clearMessages(activeTabId)}
        />
      </div>

      <SaveRequestAsModal isOpen={isSaveAsOpen} onClose={() => setIsSaveAsOpen(false)} />
    </div>
  );
};
