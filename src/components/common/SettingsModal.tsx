import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useUiStore } from '../../stores/uiStore';
import { useDesktopStore } from '../../stores/desktopStore';
import { desktopDiagnosticsService } from '../../services/desktop/diagnosticsService';
import { Modal } from './Modal';
import {
  Sliders,
  Code,
  Palette,
  Globe,
  Database,
  Shield,
  Check,
  Download,
  Upload,
  FileText,
} from 'lucide-react';
import { useHistoryStore } from '../../stores/historyStore';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setSettingsOpen, setBackupRestoreModalOpen } = useAppStore();
  const {
    theme,
    setTheme,
    editorSettings,
    updateEditorSettings,
    generalSettings,
    updateGeneralSettings,
  } = useUiStore();
  const { retentionLimit, setRetentionLimit, retainResponseBody, setRetainResponseBody } =
    useHistoryStore();
  const {
    capabilities,
    dbStatus,
    keyringStatus,
    globalProxy,
    updateGlobalProxy,
    defaultVerifySsl,
    setDefaultVerifySsl,
    setMigrationModalOpen,
    backupDatabase,
    restoreDatabase,
  } = useDesktopStore();

  const [activeTab, setActiveTab] = useState<
    'general' | 'editor' | 'appearance' | 'request' | 'proxy' | 'storage' | 'security'
  >('general');
  const [proxyForm, setProxyForm] = useState(globalProxy);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const handleSaveProxy = async () => {
    await updateGlobalProxy(proxyForm);
    setStatusNote('Proxy configuration updated.');
    setTimeout(() => setStatusNote(null), 2500);
  };

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setSettingsOpen(false)}
      title="Application Settings"
      description="Configure workspace preferences, networking proxy, SQLite storage, and security"
      maxWidth="2xl"
    >
      <div className="flex flex-col sm:flex-row gap-5 min-h-[400px]">
        {/* Left tabs */}
        <div className="w-full sm:w-48 flex sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 pb-3 sm:pb-0 sm:pr-3 shrink-0">
          {[
            { id: 'general', label: 'General', Icon: Sliders },
            { id: 'editor', label: 'Editor', Icon: Code },
            { id: 'appearance', label: 'Appearance', Icon: Palette },
            { id: 'request', label: 'Request', Icon: Globe },
            { id: 'proxy', label: 'Desktop Proxy', Icon: Globe },
            { id: 'storage', label: 'Storage & SQLite', Icon: Database },
            { id: 'security', label: 'Security & Logs', Icon: Shield },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                activeTab === id
                  ? 'bg-blue-600/20 text-cyan-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[420px] pr-1">
          {activeTab === 'general' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-200">Runtime Mode</div>
                  <div className="text-[11px] text-slate-500">
                    {capabilities.isDesktop
                      ? 'Native Tauri 2 + Rust Desktop Runtime'
                      : 'Web Browser Runtime (Fetch API + IndexedDB)'}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[11px]">
                  {capabilities.mode}
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Default Request Timeout (ms)
                </label>
                <input
                  type="number"
                  value={generalSettings.defaultTimeout}
                  onChange={(e) =>
                    updateGeneralSettings({ defaultTimeout: Number(e.target.value) || 5000 })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Startup Behavior
                </label>
                <select
                  value={generalSettings.startupBehavior}
                  onChange={(e) => updateGeneralSettings({ startupBehavior: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
                >
                  <option value="last-session">Restore last active session tabs</option>
                  <option value="default-template">Load default sample template</option>
                  <option value="empty">Start with blank request tab</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Font Size (px)</label>
                  <input
                    type="number"
                    min="10"
                    max="22"
                    value={editorSettings.fontSize}
                    onChange={(e) =>
                      updateEditorSettings({ fontSize: Number(e.target.value) || 13 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Tab Size (spaces)
                  </label>
                  <select
                    value={editorSettings.tabSize}
                    onChange={(e) =>
                      updateEditorSettings({ tabSize: Number(e.target.value) || 2 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 font-mono"
                  >
                    <option value={2}>2 spaces</option>
                    <option value={4}>4 spaces</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={editorSettings.wordWrap === 'on'}
                    onChange={(e) =>
                      updateEditorSettings({ wordWrap: e.target.checked ? 'on' : 'off' })
                    }
                    className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
                  />
                  <span>Enable Word Wrap</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={editorSettings.lineNumbers === 'on'}
                    onChange={(e) =>
                      updateEditorSettings({ lineNumbers: e.target.checked ? 'on' : 'off' })
                    }
                    className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
                  />
                  <span>Show Line Numbers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={editorSettings.minimap}
                    onChange={(e) => updateEditorSettings({ minimap: e.target.checked })}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
                  />
                  <span>Show Monaco Code Minimap</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-2">Theme Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      theme === 'dark'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm">Dark Studio</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Deep charcoal with cyan aura
                      </div>
                    </div>
                    {theme === 'dark' && <Check className="w-4 h-4 text-cyan-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm">Light Crystalline</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Crisp white with blue glass
                      </div>
                    </div>
                    {theme === 'light' && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Accent Color</label>
                <div className="flex items-center gap-3">
                  {(['blue', 'cyan', 'emerald', 'violet'] as const).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateGeneralSettings({ accentColor: color })}
                      className={`px-3 py-1.5 rounded-lg border text-xs capitalize cursor-pointer transition-all flex items-center gap-2 ${
                        generalSettings.accentColor === color
                          ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
                          : 'border-slate-700 bg-slate-900/40 text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          color === 'blue'
                            ? 'bg-blue-500'
                            : color === 'cyan'
                            ? 'bg-cyan-400'
                            : color === 'emerald'
                            ? 'bg-emerald-400'
                            : 'bg-violet-400'
                        }`}
                      />
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'request' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Default HTTP Method
                </label>
                <select
                  value={generalSettings.defaultMethod}
                  onChange={(e) => updateGeneralSettings({ defaultMethod: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Default Content-Type Header
                </label>
                <select
                  value={generalSettings.defaultContentType}
                  onChange={(e) =>
                    updateGeneralSettings({ defaultContentType: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
                >
                  <option value="application/json">application/json</option>
                  <option value="text/plain">text/plain</option>
                  <option value="application/xml">application/xml</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'proxy' && (
            <div className="space-y-3 text-xs">
              {!capabilities.supportsCustomProxy && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px]">
                  Browser mode uses your system/browser proxy automatically. Native proxy routing
                  activates in API Studio Desktop.
                </div>
              )}

              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer">
                <div>
                  <div className="font-medium text-slate-200">Enable Global HTTP/SOCKS5 Proxy</div>
                  <div className="text-[11px] text-slate-500">
                    Applies to all desktop HTTP requests unless overridden per request
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={proxyForm.enabled}
                  onChange={(e) => setProxyForm({ ...proxyForm, enabled: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
              </label>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={proxyForm.protocol}
                  onChange={(e) =>
                    setProxyForm({
                      ...proxyForm,
                      protocol: e.target.value as 'http' | 'https' | 'socks5',
                    })
                  }
                  className="px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200"
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </select>
                <input
                  type="text"
                  value={proxyForm.host}
                  onChange={(e) => setProxyForm({ ...proxyForm, host: e.target.value })}
                  placeholder="127.0.0.1"
                  className="px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 font-mono"
                />
                <input
                  type="number"
                  value={proxyForm.port}
                  onChange={(e) =>
                    setProxyForm({ ...proxyForm, port: Number(e.target.value) || 8888 })
                  }
                  placeholder="8888"
                  className="px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={proxyForm.username || ''}
                  onChange={(e) => setProxyForm({ ...proxyForm, username: e.target.value })}
                  placeholder="Proxy Username (optional)"
                  className="px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200"
                />
                <input
                  type="password"
                  value={proxyForm.password || ''}
                  onChange={(e) => setProxyForm({ ...proxyForm, password: e.target.value })}
                  placeholder="Proxy Password (stored in OS Keyring)"
                  className="px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Bypass Hosts (comma-separated)</label>
                <input
                  type="text"
                  value={proxyForm.bypassList.join(', ')}
                  onChange={(e) =>
                    setProxyForm({
                      ...proxyForm,
                      bypassList: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-emerald-400">{statusNote || ''}</span>
                <button
                  type="button"
                  onClick={handleSaveProxy}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
                >
                  Apply Proxy Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  History Retention Limit
                </label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={retentionLimit}
                  onChange={(e) => setRetentionLimit(Math.max(10, Number(e.target.value) || 50))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 font-mono"
                />
              </div>

              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer">
                <div>
                  <div className="font-medium text-slate-200">
                    Retain Response Bodies in History
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Store full response body payloads for offline inspection
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={retainResponseBody}
                  onChange={(e) => setRetainResponseBody(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
              </label>

              {capabilities.supportsSqliteStorage && (
                <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2.5">
                  <div className="font-medium text-slate-200">Native SQLite Database</div>
                  <div className="text-[11px] text-slate-400 font-mono break-all">
                    {dbStatus?.dbPath || 'Initializing app data database...'}
                    {dbStatus ? ` (Schema v${dbStatus.schemaVersion})` : ''}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void backupDatabase()}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      Backup SQLite (.db)
                    </button>
                    <button
                      type="button"
                      onClick={() => void restoreDatabase()}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      Restore SQLite (.db)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsOpen(false);
                        setMigrationModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-cyan-300 border border-blue-500/30 cursor-pointer"
                    >
                      Migrate IndexedDB → SQLite
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-500/20 space-y-2.5">
                <div className="font-medium text-slate-200">Workspace Backup & Restore (JSON)</div>
                <p className="text-[11px] text-slate-400">
                  Export a full snapshot of your collections, environments, global variables, and
                  history, or restore from an archive file.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setBackupRestoreModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-cyan-300 border border-blue-500/30 font-medium transition-colors cursor-pointer"
                >
                  Open Backup & Restore
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer">
                <div>
                  <div className="font-medium text-slate-200">
                    Strict TLS Certificate Verification (Default)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Validate server certificates against OS root authorities for all desktop requests
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={defaultVerifySsl}
                  onChange={(e) => setDefaultVerifySsl(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
              </label>

              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="font-medium text-slate-200">OS Secure Credential Storage</div>
                <div className="text-[11px] text-slate-400">
                  {capabilities.supportsNativeKeyring
                    ? keyringStatus?.available
                      ? `Connected: ${keyringStatus.backend}`
                      : `Unavailable: ${keyringStatus?.error || 'OS secret service unreachable (plaintext fallback disabled)'}`
                    : 'Available in API Studio Desktop (Windows Credential Manager / macOS Keychain / Linux Secret Service).'}
                </div>
              </div>

              {capabilities.isDesktop && (
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <div className="font-medium text-slate-200">Native Diagnostics Log Export</div>
                  <p className="text-[11px] text-slate-400">
                    Export sanitized desktop logs (all tokens, passwords, and API keys are masked).
                  </p>
                  <button
                    type="button"
                    onClick={() => void desktopDiagnosticsService.exportLogs()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Export Diagnostics Log
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 flex justify-end">
        <button
          type="button"
          onClick={() => setSettingsOpen(false)}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:brightness-110 active:brightness-95 transition-all cursor-pointer"
        >
          Done
        </button>
      </div>
    </Modal>
  );
};
