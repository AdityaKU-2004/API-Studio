import React, { useMemo } from 'react';
import { AlertTriangle, Plus, Globe } from 'lucide-react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useRequestStore } from '../../stores/requestStore';
import { useAppStore } from '../../stores/appStore';

export const VariablePreviewBanner: React.FC = () => {
  const { tabs, activeTabId } = useRequestStore();
  const { getResolvedVariables } = useEnvironmentStore();
  const { setEnvironmentModalOpen, setGlobalVariablesModalOpen } = useAppStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const resolvedVars = getResolvedVariables();

  const undefinedVariables = useMemo(() => {
    if (!activeTab?.request) return [];

    const req = activeTab.request;
    const textToScan = [
      req.url,
      ...(req.params || []).map((p) => `${p.key} ${p.value}`),
      ...(req.headers || []).map((h) => `${h.key} ${h.value}`),
      req.rawBody || '',
    ].join(' ');

    const regex = /\{\{([a-zA-Z0-9_\-\.]+)\}\}/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(textToScan)) !== null) {
      const varName = match[1].trim();
      if (resolvedVars[varName] === undefined) {
        found.add(varName);
      }
    }

    return Array.from(found);
  }, [activeTab, resolvedVars]);

  if (undefinedVariables.length === 0) return null;

  return (
    <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-300 animate-in fade-in duration-100 select-none">
      <div className="flex items-center gap-2 truncate">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="truncate">
          Unresolved variable{undefinedVariables.length > 1 ? 's' : ''}:{' '}
          <strong className="font-mono font-medium text-amber-200">
            {undefinedVariables.map((v) => `{{${v}}}`).join(', ')}
          </strong>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setEnvironmentModalOpen(true)}
          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium transition-colors text-[11px]"
        >
          Add to Environment
        </button>
        <button
          type="button"
          onClick={() => setGlobalVariablesModalOpen(true)}
          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium transition-colors text-[11px] flex items-center gap-1"
        >
          <Globe className="w-3 h-3" />
          <span>Globals</span>
        </button>
      </div>
    </div>
  );
};
