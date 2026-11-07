import React, { useState, useRef, useCallback } from 'react';
import { RequestBuilder } from '../request/RequestBuilder';
import { ResponsePanel } from '../response/ResponsePanel';
import { useUiStore } from '../../stores/uiStore';

export const WorkspaceSplit: React.FC = () => {
  const { splitRatio, setSplitRatio } = useUiStore();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDragging = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const offsetY = moveEvent.clientY - rect.top;
        const newRatio = (offsetY / rect.height) * 100;
        setSplitRatio(newRatio);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [setSplitRatio]
  );

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Top Request Builder pane */}
      <div
        style={{ height: `${splitRatio}%` }}
        className="w-full overflow-hidden border-b border-blue-500/15 dark:border-blue-500/15 light:border-blue-200/60"
      >
        <RequestBuilder />
      </div>

      {/* Resizable horizontal splitter handle */}
      <div
        onMouseDown={startDragging}
        className={`h-1.5 w-full cursor-row-resize hover:bg-cyan-500/50 transition-colors z-20 flex items-center justify-center relative select-none shrink-0 ${
          isDragging ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-slate-800/80'
        }`}
        title="Drag to resize Request and Response split ratio"
      >
        <div className="w-8 h-0.5 rounded-full bg-slate-500/80" />
      </div>

      {/* Bottom Response pane */}
      <div style={{ height: `${100 - splitRatio}%` }} className="w-full overflow-hidden">
        <ResponsePanel />
      </div>
    </div>
  );
};
