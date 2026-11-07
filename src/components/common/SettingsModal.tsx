import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useUiStore } from '../../stores/uiStore';
import { Modal } from './Modal';
import { Sliders, Code, Palette, Globe, Check } from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setSettingsOpen } = useAppStore();
  const {
    theme,
    setTheme,
    editorSettings,
    updateEditorSettings,
    generalSettings,
    updateGeneralSettings,
  } = useUiStore();

  const [activeTab, setActiveTab] = useState<'general' | 'editor' | 'appearance' | 'request'>('general');

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setSettingsOpen(false)}
      title="Application Settings"
      description="Configure workspace preferences, code editor, and defaults"
      maxWidth="2xl"
    >
      <div className="flex flex-col sm:flex-row gap-5 min-h-[380px]">
        {/* Left tabs */}
        <div className="w-full sm:w-44 flex sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 pb-3 sm:pb-0 sm:pr-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
              activeTab === 'general'
                ? 'bg-blue-600/20 text-cyan-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Sliders className="w-4 h-4" />
            General
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-blue-600/20 text-cyan-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Code className="w-4 h-4" />
            Editor
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-blue-600/20 text-cyan-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Palette className="w-4 h-4" />
            Appearance
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
              activeTab === 'request'
                ? 'bg-blue-600/20 text-cyan-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Globe className="w-4 h-4" />
            Request
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {activeTab === 'general' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Default Request Timeout (ms)
                </label>
                <input
                  type="number"
                  value={generalSettings.defaultTimeout}
                  onChange={(e) => updateGeneralSettings({ defaultTimeout: Number(e.target.value) || 5000 })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Maximum execution window before canceling client connection simulation.
                </span>
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
                    onChange={(e) => updateEditorSettings({ fontSize: Number(e.target.value) || 13 })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Tab Size (spaces)</label>
                  <select
                    value={editorSettings.tabSize}
                    onChange={(e) => updateEditorSettings({ tabSize: Number(e.target.value) || 2 })}
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
                    onChange={(e) => updateEditorSettings({ wordWrap: e.target.checked ? 'on' : 'off' })}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
                  />
                  <span>Enable Word Wrap</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={editorSettings.lineNumbers === 'on'}
                    onChange={(e) => updateEditorSettings({ lineNumbers: e.target.checked ? 'on' : 'off' })}
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
                      <div className="text-[11px] text-slate-500 mt-0.5">Deep charcoal with cyan aura</div>
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
                      <div className="text-[11px] text-slate-500 mt-0.5">Crisp white with blue glass</div>
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
                <label className="block text-slate-300 font-medium mb-1.5">Default HTTP Method</label>
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
                <label className="block text-slate-300 font-medium mb-1.5">Default Content-Type Header</label>
                <select
                  value={generalSettings.defaultContentType}
                  onChange={(e) => updateGeneralSettings({ defaultContentType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
                >
                  <option value="application/json">application/json</option>
                  <option value="text/plain">text/plain</option>
                  <option value="application/xml">application/xml</option>
                </select>
              </div>
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
