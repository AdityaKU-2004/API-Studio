import React from 'react';
import {
  Radio,
  Square,
  Save,
  Settings2,
  Info,
  AlertCircle,
} from 'lucide-react';
import { SseConfig, SseConnectionMode, SseConnectionStatus } from '../../types';
import { RequestTypeSelector } from '../../components/request-types/RequestTypeSelector';
import { useRequestStore } from '../../stores/requestStore';

interface SseConnectionBarProps {
  config: SseConfig;
  status: SseConnectionStatus;
  activeTransport?: 'eventsource' | 'fetch';
  reconnectStrategy?: 'browser-managed' | 'application-managed';
  reconnectAttempt: number;
  errorMessage?: string;
  showSettings: boolean;
  onToggleSettings: () => void;
  onUpdateConfig: (updates: Partial<SseConfig>) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSave: () => void;
}

const STATUS_BADGES: Record<SseConnectionStatus, { label: string; cls: string; dot: string }> = {
  disconnected: { label: 'Disconnected', cls: 'text-slate-400', dot: 'bg-slate-500' },
  connecting: { label: 'Connecting...', cls: 'text-amber-300', dot: 'bg-amber-400 animate-pulse' },
  connected: { label: 'Streaming', cls: 'text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  reconnecting: { label: 'Reconnecting', cls: 'text-amber-300', dot: 'bg-amber-400 animate-pulse' },
  error: { label: 'Error', cls: 'text-red-300', dot: 'bg-red-500' },
  closed: { label: 'Closed', cls: 'text-slate-400', dot: 'bg-slate-500' },
};

export const SseConnectionBar: React.FC<SseConnectionBarProps> = ({
  config,
  status,
  activeTransport,
  reconnectStrategy,
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
      {/* Top Row: Protocol Selector + Status + Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <RequestTypeSelector value="sse" onChange={switchActiveRequestType} compact />

          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span className={badge.cls}>
              {badge.label}
              {status === 'reconnecting' && reconnectAttempt > 0 ? ` (#${reconnectAttempt})` : ''}
            </span>
          </div>

          {activeTransport && (
            <span className="text-[11px] font-mono text-slate-400">
              {activeTransport === 'eventsource' ? 'EventSource' : 'Fetch Stream'}
              {reconnectStrategy ? ` · ${reconnectStrategy}` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSettings}
            className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors ${
              showSettings
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Stream Options</span>
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

      {/* URL + Transport Mode + Connect/Disconnect */}
      <div className="flex items-center gap-2">
        <select
          value={config.connectionMode}
          disabled={isActive}
          onChange={(e) => onUpdateConfig({ connectionMode: e.target.value as SseConnectionMode })}
          title="SSE Transport Mode"
          className="px-2.5 py-2 rounded-lg bg-slate-900/90 border border-slate-700 disabled:opacity-60 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
        >
          <option value="auto">Auto Mode</option>
          <option value="eventsource">EventSource</option>
          <option value="fetch">Fetch Stream (Headers)</option>
        </select>

        <input
          type="text"
          value={config.url}
          disabled={isActive}
          onChange={(e) => onUpdateConfig({ url: e.target.value })}
          placeholder="https://stream.example.com/events"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 disabled:opacity-60 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
        />

        {isActive ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Disconnect</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Connect Stream</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-[11px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span>
          Standard <code className="text-slate-300">EventSource</code> manages reconnects in the
          browser and omits custom headers. Select <strong className="text-slate-300">Fetch Stream</strong>{' '}
          (or <strong className="text-slate-300">Auto</strong> with custom Headers/Auth) to send
          custom headers with <code className="text-slate-300">Last-Event-ID</code> and{' '}
          <code className="text-slate-300">AbortController</code> cancellation.
        </span>
      </div>

      {/* Collapsible Stream Options */}
      {showSettings && (
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.withCredentials}
              onChange={(e) => onUpdateConfig({ withCredentials: e.target.checked })}
            />
            <span>With Credentials (Cookies)</span>
          </label>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoReconnect}
              onChange={(e) => onUpdateConfig({ autoReconnect: e.target.checked })}
            />
            <span>Auto-Reconnect (Fetch mode)</span>
          </label>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.retainHistory}
              onChange={(e) => onUpdateConfig({ retainHistory: e.target.checked })}
            />
            <span>Record Session Summary</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 shrink-0">Buffer Cap:</span>
            <input
              type="number"
              min={50}
              max={5000}
              value={config.historyLimit}
              onChange={(e) => onUpdateConfig({ historyLimit: Number(e.target.value) || 500 })}
              className="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200"
            />
          </div>

          {config.autoReconnect && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Max Retries:</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={config.maxReconnectAttempts}
                  onChange={(e) =>
                    onUpdateConfig({ maxReconnectAttempts: Number(e.target.value) || 5 })
                  }
                  className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Retry Delay (ms):</span>
                <input
                  type="number"
                  min={300}
                  step={500}
                  value={config.reconnectDelayMs}
                  onChange={(e) =>
                    onUpdateConfig({ reconnectDelayMs: Number(e.target.value) || 3000 })
                  }
                  className="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
