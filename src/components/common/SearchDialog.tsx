import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Folder, Send, Clock, Layers, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useHistoryStore } from '../../stores/historyStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { MethodBadge } from './MethodBadge';
import { ApiRequest } from '../../types';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'request' | 'collection' | 'history' | 'environment';
  method?: string;
  request?: ApiRequest;
  environmentId?: string;
}

export const SearchDialog: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setActiveView } = useAppStore();
  const { collections } = useCollectionStore();
  const { openRequestInTab } = useRequestStore();
  const { history } = useHistoryStore();
  const { environments, setActiveEnvironmentId } = useEnvironmentStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Global keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  // Aggregate searchable items
  const results: SearchResultItem[] = useMemo(() => {
    const items: SearchResultItem[] = [];
    const q = query.toLowerCase().trim();

    // 1. Collections & Requests
    const traverse = (cols: typeof collections, parentPath = '') => {
      for (const item of cols) {
        const fullPath = parentPath ? `${parentPath} / ${item.name}` : item.name;

        if (item.type === 'collection') {
          if (!q || item.name.toLowerCase().includes(q)) {
            items.push({
              id: 'col-' + item.id,
              title: item.name,
              subtitle: item.description || 'Collection',
              category: 'collection',
            });
          }
          if (item.children) traverse(item.children, fullPath);
        } else if (item.type === 'folder') {
          if (!q || item.name.toLowerCase().includes(q)) {
            items.push({
              id: 'fld-' + item.id,
              title: item.name,
              subtitle: `Folder in ${parentPath}`,
              category: 'collection',
            });
          }
          if (item.children) traverse(item.children, fullPath);
        } else if (item.type === 'request' && item.request) {
          if (
            !q ||
            item.name.toLowerCase().includes(q) ||
            item.request.url.toLowerCase().includes(q) ||
            item.request.method.toLowerCase().includes(q)
          ) {
            items.push({
              id: 'req-' + item.id,
              title: item.name,
              subtitle: `${item.request.url} · ${parentPath}`,
              category: 'request',
              method: item.request.method,
              request: item.request,
            });
          }
        }
      }
    };
    traverse(collections);

    // 2. Environments
    for (const env of environments) {
      if (!q || env.name.toLowerCase().includes(q)) {
        items.push({
          id: 'env-' + env.id,
          title: env.name,
          subtitle: `${env.variables.length} environment variables defined`,
          category: 'environment',
          environmentId: env.id,
        });
      }
    }

    // 3. History
    for (const hist of history.slice(0, 8)) {
      if (!q || hist.url.toLowerCase().includes(q) || hist.method.toLowerCase().includes(q)) {
        items.push({
          id: 'hist-' + hist.id,
          title: hist.url,
          subtitle: `Status: ${hist.status} · Time: ${hist.timeMs}ms · ${new Date(hist.timestamp).toLocaleTimeString()}`,
          category: 'history',
          method: hist.method,
          request: hist.request,
        });
      }
    }

    return items.slice(0, 15);
  }, [collections, environments, history, query]);

  const handleSelect = (item: SearchResultItem) => {
    if (item.request) {
      openRequestInTab(item.request);
      setActiveView('collections');
    } else if (item.environmentId) {
      setActiveEnvironmentId(item.environmentId);
      setActiveView('environments');
    } else if (item.category === 'collection') {
      setActiveView('collections');
    }
    setCommandPaletteOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={() => setCommandPaletteOpen(false)}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-2xl rounded-xl glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 text-slate-100 dark:text-slate-100 light:text-slate-900 border border-blue-500/25 dark:border-blue-500/25 light:border-blue-300 shadow-2xl overflow-hidden z-10"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-700/60 dark:border-slate-800/80 light:border-slate-200">
          <Search className="w-5 h-5 text-cyan-400 dark:text-cyan-400 light:text-blue-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search collections, requests, environments, or history..."
            className="w-full bg-transparent text-sm text-slate-100 dark:text-slate-100 light:text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/50 dark:bg-slate-800/50 light:bg-slate-100 border border-slate-700/60 dark:border-slate-700/60 light:border-slate-300 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No matching requests or resources found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                      : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.method ? (
                      <MethodBadge method={item.method as any} size="sm" />
                    ) : item.category === 'collection' ? (
                      <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : item.category === 'environment' ? (
                      <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                    )}

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
                    <span className="capitalize">{item.category}</span>
                    {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="font-mono text-cyan-400">API Studio Quick Navigator</span>
        </div>
      </div>
    </div>
  );
};
