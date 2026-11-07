import React, { useState, useRef, useCallback } from 'react';
import {
  Folder,
  Clock,
  Layers,
  Cpu,
  Server,
  Activity,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useUiStore } from '../../stores/uiStore';
import { SidebarSection } from '../../types';
import { CollectionTree } from '../collections/CollectionTree';
import { EnvironmentManager } from '../environments/EnvironmentManager';
import { HistoryPage } from '../history/HistoryPage';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, setSettingsOpen } = useAppStore();
  const {
    sidebarWidth,
    setSidebarWidth,
    isSidebarCollapsed,
    toggleSidebar,
  } = useUiStore();

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(sidebarWidth);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        setSidebarWidth(startWidthRef.current + delta);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [sidebarWidth, setSidebarWidth]
  );

  const navItems: { id: SidebarSection; label: string; icon: React.ReactNode }[] = [
    { id: 'collections', label: 'Collections', icon: <Folder className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
    { id: 'environments', label: 'Environments', icon: <Layers className="w-4 h-4" /> },
    { id: 'apis', label: 'APIs (Specs)', icon: <Cpu className="w-4 h-4" /> },
    { id: 'mock-servers', label: 'Mock Servers', icon: <Server className="w-4 h-4" /> },
    { id: 'monitors', label: 'Monitors', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <aside className="relative flex h-full select-none shrink-0 z-20">
      {/* 1. Left Vertical Icon Rail */}
      <div className="w-12 h-full flex flex-col items-center justify-between py-3 border-r border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 bg-[#0d1017] dark:bg-[#0d1017] light:bg-slate-50/90 backdrop-blur-xl shrink-0 z-10">
        <div className="flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveView(item.id);
                  if (isSidebarCollapsed) toggleSidebar();
                }}
                title={item.label}
                className={`relative p-2 rounded-xl transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-blue-600/20 text-cyan-400 border border-blue-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {item.icon}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-cyan-400 rounded-r shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Rail items: collapse toggle & settings */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-cyan-400" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Content Pane (Collections / History / Environments / Placeholders) */}
      {!isSidebarCollapsed && (
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="h-full flex flex-col border-r border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60 bg-[#121620]/90 dark:bg-[#121620]/90 light:bg-white/80 backdrop-blur-xl overflow-hidden transition-width duration-75"
        >
          {activeView === 'collections' && <CollectionTree />}
          {activeView === 'history' && <HistoryPage isSidebarView />}
          {activeView === 'environments' && <EnvironmentManager isSidebarView />}

          {/* Placeholders for upcoming Phase 2 tools */}
          {activeView === 'apis' && (
            <div className="p-6 text-center text-xs text-slate-400 space-y-3">
              <Cpu className="w-10 h-10 mx-auto text-cyan-400/80 stroke-1" />
              <div className="font-semibold text-slate-200 text-sm">OpenAPI & AsyncAPI Specs</div>
              <p className="text-slate-400 leading-relaxed">
                Design and document your API specifications with instant validation.
              </p>
              <div className="inline-block px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-cyan-400 text-[11px] font-mono">
                Ready for Phase 2 Spec Engine
              </div>
            </div>
          )}

          {activeView === 'mock-servers' && (
            <div className="p-6 text-center text-xs text-slate-400 space-y-3">
              <Server className="w-10 h-10 mx-auto text-amber-400/80 stroke-1" />
              <div className="font-semibold text-slate-200 text-sm">Mock Servers</div>
              <p className="text-slate-400 leading-relaxed">
                Simulate endpoints before the backend service is deployed.
              </p>
              <div className="inline-block px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono">
                Ready for Tauri/Rust Mock Daemon
              </div>
            </div>
          )}

          {activeView === 'monitors' && (
            <div className="p-6 text-center text-xs text-slate-400 space-y-3">
              <Activity className="w-10 h-10 mx-auto text-emerald-400/80 stroke-1" />
              <div className="font-semibold text-slate-200 text-sm">Monitors & Health</div>
              <p className="text-slate-400 leading-relaxed">
                Automated continuous testing and uptime probing.
              </p>
              <div className="inline-block px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
                Ready for Uptime Prober
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Drag handle for resizing */}
      {!isSidebarCollapsed && (
        <div
          onMouseDown={startResizing}
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-cyan-500/50 transition-colors z-30 ${
            isResizing ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : ''
          }`}
          title="Drag to resize sidebar width"
        />
      )}
    </aside>
  );
};
