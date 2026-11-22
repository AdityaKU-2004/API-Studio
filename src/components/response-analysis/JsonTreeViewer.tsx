import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Search,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';

interface JsonTreeViewerProps {
  data: unknown;
  rawText?: string;
}

interface TreeNodeProps {
  nodeKey: string | number;
  value: unknown;
  path: string;
  depth: number;
  searchTerm: string;
  forceExpandState: 'auto' | 'expand' | 'collapse';
}

function getValueType(val: unknown): 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  const t = typeof val;
  if (t === 'object') return 'object';
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  return 'string';
}

function matchesSearchRecursive(key: string | number, val: unknown, q: string): boolean {
  if (!q) return true;
  if (String(key).toLowerCase().includes(q)) return true;
  if (val === null) return 'null'.includes(q);
  if (typeof val !== 'object') return String(val).toLowerCase().includes(q);
  if (Array.isArray(val)) {
    return val.some((item, idx) => matchesSearchRecursive(idx, item, q));
  }
  return Object.entries(val as Record<string, unknown>).some(([k, v]) =>
    matchesSearchRecursive(k, v, q)
  );
}

const TreeNode: React.FC<TreeNodeProps> = ({
  nodeKey,
  value,
  path,
  depth,
  searchTerm,
  forceExpandState,
}) => {
  const type = getValueType(value);
  const isContainer = type === 'object' || type === 'array';
  const [localExpanded, setLocalExpanded] = useState(depth < 2);
  const [copiedMode, setCopiedMode] = useState<'value' | 'path' | null>(null);

  const q = searchTerm.trim().toLowerCase();
  const isExpanded = useMemo(() => {
    if (q) return true;
    if (forceExpandState === 'expand') return true;
    if (forceExpandState === 'collapse') return false;
    return localExpanded;
  }, [q, forceExpandState, localExpanded]);

  if (q && !matchesSearchRecursive(nodeKey, value, q)) {
    return null;
  }

  const entries: Array<[string | number, unknown]> = isContainer
    ? type === 'array'
      ? (value as unknown[]).map((item, idx) => [idx, item])
      : Object.entries(value as Record<string, unknown>)
    : [];

  const handleCopy = (mode: 'value' | 'path', e: React.MouseEvent) => {
    e.stopPropagation();
    const text =
      mode === 'path'
        ? path
        : typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 1500);
  };

  const formatChildPath = (childKey: string | number): string => {
    if (typeof childKey === 'number') return `${path}[${childKey}]`;
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(childKey)
      ? `${path}.${childKey}`
      : `${path}['${childKey.replace(/'/g, "\\'")}']`;
  };

  const renderPrimitiveValue = () => {
    if (type === 'string') {
      return <span className="text-emerald-300 break-all">&ldquo;{String(value)}&rdquo;</span>;
    }
    if (type === 'number') {
      return <span className="text-cyan-300 tabular-nums">{String(value)}</span>;
    }
    if (type === 'boolean') {
      return <span className="text-amber-300">{String(value)}</span>;
    }
    return <span className="text-slate-500 italic">null</span>;
  };

  const isDirectMatch =
    q &&
    (String(nodeKey).toLowerCase().includes(q) ||
      (!isContainer && String(value).toLowerCase().includes(q)));

  return (
    <div className="select-text">
      <div
        onClick={() => isContainer && setLocalExpanded(!isExpanded)}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className={`group flex items-center justify-between gap-2 py-0.5 pr-2 rounded hover:bg-slate-800/40 font-mono text-[11px] ${
          isContainer ? 'cursor-pointer' : ''
        } ${isDirectMatch ? 'bg-cyan-500/10' : ''}`}
      >
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          {isContainer ? (
            <span className="text-slate-500 mt-0.5 shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          <span className="text-blue-300 shrink-0">
            {typeof nodeKey === 'number' ? `[${nodeKey}]` : nodeKey}:
          </span>

          {isContainer ? (
            <span className="text-slate-400">
              {type === 'array' ? `Array[${entries.length}]` : `Object{${entries.length}}`}
            </span>
          ) : (
            renderPrimitiveValue()
          )}

          <span className="text-[9px] text-slate-600 uppercase shrink-0 mt-0.5">{type}</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={(e) => handleCopy('path', e)}
            title={`Copy JSONPath (${path})`}
            className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer"
          >
            {copiedMode === 'path' ? 'Path Copied' : 'Path'}
          </button>
          <button
            type="button"
            onClick={(e) => handleCopy('value', e)}
            title="Copy value"
            className="p-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            {copiedMode === 'value' ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {isContainer && isExpanded && (
        <div>
          {entries.map(([k, v]) => (
            <TreeNode
              key={String(k)}
              nodeKey={k}
              value={v}
              path={formatChildPath(k)}
              depth={depth + 1}
              searchTerm={searchTerm}
              forceExpandState={forceExpandState}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const JsonTreeViewer: React.FC<JsonTreeViewerProps> = ({ data, rawText }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [forceExpandState, setForceExpandState] = useState<'auto' | 'expand' | 'collapse'>('auto');

  const parsedData = useMemo(() => {
    if (data !== undefined) return { ok: true, value: data };
    if (!rawText) return { ok: false, value: null };
    try {
      return { ok: true, value: JSON.parse(rawText) };
    } catch {
      return { ok: false, value: null };
    }
  }, [data, rawText]);

  if (!parsedData.ok) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-xs text-slate-400">
        Tree view requires a valid JSON payload.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter keys or values..."
            className="w-full pl-7 pr-2 py-1 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setForceExpandState('expand')}
            className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <ChevronsUpDown className="w-3 h-3 text-cyan-400" />
            <span>Expand All</span>
          </button>
          <button
            type="button"
            onClick={() => setForceExpandState('collapse')}
            className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <ChevronsDownUp className="w-3 h-3 text-slate-400" />
            <span>Collapse All</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-2 px-1">
        <TreeNode
          nodeKey="root"
          value={parsedData.value}
          path="$"
          depth={0}
          searchTerm={searchTerm}
          forceExpandState={forceExpandState}
        />
      </div>
    </div>
  );
};
