import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Search,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  ChevronDown,
  Sparkles,
  User,
  Check,
  Plus,
  Terminal,
} from 'lucide-react';
import { TrafficLights } from '../common/TrafficLights';
import { useAppStore } from '../../stores/appStore';
import { useUiStore } from '../../stores/uiStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useExecutionStore } from '../../stores/executionStore';

export const TopBar: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    setCommandPaletteOpen,
    setSettingsOpen,
    setDocsOpen,
    setEnvironmentModalOpen,
  } = useAppStore();

  const { theme, toggleTheme } = useUiStore();
  const { environments, activeEnvironmentId, setActiveEnvironmentId } = useEnvironmentStore();

  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isEnvMenuOpen, setIsEnvMenuOpen] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
      if (envRef.current && !envRef.current.contains(e.target as Node)) {
        setIsEnvMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-12 w-full flex items-center justify-between px-3 border-b border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 bg-[#10141d]/90 dark:bg-[#10141d]/90 light:bg-white/85 backdrop-blur-xl select-none z-30 shrink-0">
      {/* Left zone: macOS traffic lights + Logo & Workspace */}
      <div className="flex items-center gap-3">
        <TrafficLights />

        <div className="h-4 w-px bg-slate-700/60 dark:bg-slate-800/80 light:bg-slate-300 mx-0.5" />

        {/* Brand Lockup */}
        <div className="flex items-center gap-2 pr-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-500 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)]">
            <span className="text-[11px] font-black tracking-tight text-white font-mono">AS</span>
          </div>
          <span className="text-xs font-bold tracking-tight text-slate-100 dark:text-slate-100 light:text-slate-900">
            API Studio
          </span>
        </div>

        {/* Workspace selector */}
        <div className="relative" ref={workspaceRef}>
          <button
            type="button"
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-slate-100 hover:bg-slate-800/50 dark:hover:bg-slate-800/50 light:hover:bg-slate-100 border border-transparent hover:border-slate-700/50 transition-colors cursor-pointer"
          >
            <span className="truncate max-w-[120px]">{activeWorkspace.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isWorkspaceMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 text-slate-200 dark:text-slate-200 light:text-slate-800 border border-blue-500/20 dark:border-blue-500/20 light:border-blue-200 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Workspaces
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspaceId(ws.id);
                    setIsWorkspaceMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 dark:hover:bg-blue-600/20 light:hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <div className="truncate">
                    <div className="font-medium text-slate-200 dark:text-slate-200 light:text-slate-800">{ws.name}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{ws.description}</div>
                  </div>
                  {ws.id === activeWorkspaceId && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle: Search bar button */}
      <div className="flex-1 max-w-md mx-4">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#141923]/80 dark:bg-[#141923]/80 light:bg-slate-100/90 text-slate-400 dark:text-slate-400 light:text-slate-500 border border-slate-700/50 dark:border-slate-800/80 light:border-slate-200 hover:border-cyan-500/40 text-xs transition-all shadow-inner group cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            <span className="truncate">Search collections, requests, environments...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800/80 dark:bg-slate-800/80 light:bg-white text-slate-300 dark:text-slate-300 light:text-slate-600 border border-slate-700/60 dark:border-slate-700/60 light:border-slate-200">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right zone: Environment selector + Theme toggle + Help + Settings + Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Environment Selector */}
        <div className="relative" ref={envRef}>
          <button
            type="button"
            onClick={() => setIsEnvMenuOpen(!isEnvMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800/40 dark:bg-slate-800/40 light:bg-blue-50/80 text-cyan-400 dark:text-cyan-400 light:text-blue-700 border border-cyan-500/25 dark:border-cyan-500/25 light:border-blue-300 hover:bg-cyan-500/10 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="truncate max-w-[100px]">
              {activeEnvironment ? activeEnvironment.name : 'No Environment'}
            </span>
            <ChevronDown className="w-3 h-3 text-cyan-400/80" />
          </button>

          {isEnvMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-52 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 text-slate-200 dark:text-slate-200 light:text-slate-800 border border-blue-500/20 dark:border-blue-500/20 light:border-blue-200 shadow-xl py-1 z-50">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Environments
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveEnvironmentId(null);
                  setIsEnvMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 dark:hover:bg-blue-600/20 light:hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <span className="text-slate-400">No Environment</span>
                {activeEnvironmentId === null && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
              {environments.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => {
                    setActiveEnvironmentId(env.id);
                    setIsEnvMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 dark:hover:bg-blue-600/20 light:hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-slate-200 dark:text-slate-200 light:text-slate-800">{env.name}</span>
                  {env.id === activeEnvironmentId && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              ))}
              <div className="border-t border-slate-700/50 dark:border-slate-800/80 light:border-slate-200 mt-1 pt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEnvMenuOpen(false);
                    setEnvironmentModalOpen(true);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-cyan-400 hover:bg-blue-600/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manage Environments</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEnvMenuOpen(false);
                    useAppStore.getState().setGlobalVariablesModalOpen(true);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-slate-300 hover:bg-blue-600/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Global Variables</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 dark:hover:bg-slate-800/60 light:hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
        </button>

        {/* Console Toggle Button */}
        <button
          type="button"
          onClick={() => useExecutionStore.getState().toggleConsole()}
          title="Toggle Execution Console"
          className="relative p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 dark:hover:bg-slate-800/60 light:hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Terminal className="w-4 h-4 text-cyan-400" />
          {useExecutionStore.getState().logs.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
          )}
        </button>

        {/* Docs Button */}
        <button
          type="button"
          onClick={() => setDocsOpen(true)}
          title="Documentation & Shortcuts"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 dark:hover:bg-slate-800/60 light:hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 dark:hover:bg-slate-800/60 light:hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Profile Avatar */}
        <div className="flex items-center pl-1">
          <div
            title="Logged in as Developer (Practice Server)"
            className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1px] cursor-pointer hover:ring-2 hover:ring-cyan-400/50 transition-all"
          >
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-bold text-cyan-300">
              DEV
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
