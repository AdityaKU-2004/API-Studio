import React from 'react';
import {
  PlugZap,
  Unplug,
  Save,
  Settings2,
  Info,
  AlertCircle,
} from 'lucide-react';
import {
  WebSocketConfig,
  WebSocketConnectionStatus,
} from '../../types';
import { RequestTypeSelector } from '../../components/request-types/RequestTypeSelector';
import { useRequestStore } from '../../stores/requestStore';

interface WebSocketConnectionBarProps {
  config: WebSocketConfig;
  status: WebSocketConnectionStatus;
  reconnectAttempt: number;
  errorMessage?: string;
  showSettings: boolean;
  onToggleSettings: () => void;
  onUpdateConfig: (updates: Partial<WebSocketConfig>) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSave: () => void;
}

const STATUS_BADGES: Record<WebSocketConnectionStatus, { label: string; cls: string; dot: string }> = {
  disconnected: { label: 'Disconnected', cls: 'text-slate-400', dot: 'bg-slate-500' },
  connecting: { label: 'Connecting...', cls: 'text-amber-300', dot: 'bg-amber-400 animate-pulse' },
  connected: { label: 'Connected', cls: 'text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  reconnecting: { label: 'Reconnecting', cls: 'text-amber-300', dot: 'bg-amber-400 animate-pulse' },
  error: { label: 'Error', cls: 'text-red-300', dot: 'bg-red-500' },
  closed: { label: 'Closed', cls: 'text-slate-400', dot: 'bg-slate-500' },
};

export const WebSocketConnectionBar: React.FC<WebSocketConnectionBarProps> = ({
  config,
  status,
  reconnectAttempt,
  errorMessage,
  showSettings,
  onToggleSettings,
  onUpdateConfig,
  onConnect,
  onDisconnect,
  onSave,
}) => {
  const { switchActiveRequestType } = useRequestStore();
  const badge = STATUS_BADGES[status] || STATUS_BADGES.disconnected;
  const isActive = status === 'connected' || status === 'connecting' || status === 'reconnecting';

  return (
    <div className="px-3 pt-2.5 pb-2.5 border-b border-blue-500/15 space-y-2 shrink-0 bg-[#11151e]/80">
      {/* Top strip: protocol selector, status, config & save */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <RequestTypeSelector
            value="websocket"
            onChange={switchActiveRequestType}
            compact
          />
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span className={badge.cls}>
              {badge.label}
              {status === 'reconnecting' && reconnectAttempt > 0 ? ` (#${reconnectAttempt})` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSettings}
            className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors ${
              showSettings
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Connection Settings</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-blue-400" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Endpoint URL + Connect/Disconnect */}
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold shrink-0">
          WS
        </span>
        <input
          type="text"
          value={config.url}
          onChange={(e) => onUpdateConfig({ url: e.target.value })}
          disabled={isActive}
          placeholder="wss://echo.websocket.events or ws://localhost:8080/ws"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 disabled:opacity-60 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
        />

        {isActive ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Unplug className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
          >
            <PlugZap className="w-3.5 h-3.5" />
            <span>Connect</span>
          </button>
        )}
      </div>

      {/* Error banner if connection failed */}
      {errorMessage && (
        <div className="px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-[11px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {/* Honest browser WebSocket limitation notice */}
      <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400">
        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
        <span>
          Browser WebSocket limitation: Custom HTTP handshake headers and RFC 6455 protocol ping/pong
          control frames cannot be set from browser JS. Use subprotocols or URL query params for auth,
          and optional application-level heartbeat messages below.
        </span>
      </div>

      {/* Collapsible Connection & Heartbeat Settings */}
      {showSettings && (
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Subprotocols (comma-separated)
            </label>
            <input
              type="text"
              value={(config.protocols || []).join(', ')}
              onChange={(e) =>
                onUpdateConfig({
                  protocols: e.target.value
                    .split(',')
                    .map((p) => p.trim())
                    .filter(Boolean),
                })
              }
              placeholder="e.g. graphql-ws, v1.json"
              className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Connect Timeout (ms)</label>
              <input
                type="number"
                min={1000}
                step={500}
                value={config.connectionTimeoutMs}
                onChange={(e) =>
                  onUpdateConfig({ connectionTimeoutMs: Number(e.target.value) || 10000 })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 font-mono tabular-nums text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">History Limit</label>
              <input
                type="number"
                min={20}
                max={2000}
                value={config.historyLimit}
                onChange={(e) => onUpdateConfig({ historyLimit: Number(e.target.value) || 200 })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 font-mono tabular-nums text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoReconnect}
                  onChange={(e) => onUpdateConfig({ autoReconnect: e.target.checked })}
                />
                <span>Auto-Reconnect</span>
              </label>
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.retainHistory}
                  onChange={(e) => onUpdateConfig({ retainHistory: e.target.checked })}
                />
                <span>Record Session to History</span>
              </label>
            </div>
            {config.autoReconnect && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={config.maxReconnectAttempts}
                  onChange={(e) =>
                    onUpdateConfig({ maxReconnectAttempts: Number(e.target.value) || 3 })
                  }
                  title="Max reconnect attempts"
                  placeholder="Max attempts"
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200"
                />
                <input
                  type="number"
                  min={250}
                  step={250}
                  value={config.reconnectDelayMs}
                  onChange={(e) =>
                    onUpdateConfig({ reconnectDelayMs: Number(e.target.value) || 2000 })
                  }
                  title="Reconnect delay (ms)"
                  placeholder="Delay ms"
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200"
                />
              </div>
            )}
          </div>

          {/* App-level heartbeat row */}
          <div className="md:col-span-3 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.heartbeatEnabled}
                onChange={(e) => onUpdateConfig({ heartbeatEnabled: e.target.checked })}
              />
              <span>Application-Level Heartbeat (JSON/Text frame)</span>
            </label>
            {config.heartbeatEnabled && (
              <>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={config.heartbeatIntervalMs}
                  onChange={(e) =>
                    onUpdateConfig({ heartbeatIntervalMs: Number(e.target.value) || 30000 })
                  }
                  className="w-28 px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200"
                  title="Interval in milliseconds"
                />
                <span className="text-[11px] text-slate-500">ms</span>
                <input
                  type="text"
                  value={config.heartbeatMessage}
                  onChange={(e) => onUpdateConfig({ heartbeatMessage: e.target.value })}
                  placeholder='{"type":"ping"}'
                  className="flex-1 min-w-[180px] px-2.5 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
