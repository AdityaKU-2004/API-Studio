import React, { useMemo, useState } from 'react';
import { GitFork, Download, RefreshCw, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { ApiRequest, CollectionItem } from '../../types';
import { useCollectionStore } from '../../stores/collectionStore';
import { useSpecStore } from '../../stores/specStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import {
  buildDependencyGraph,
  exportDependencyGraphAsMermaid,
} from '../../services/dependency/dependencyAnalyzer';
import { db } from '../../database/database';

function collectReqs(items: CollectionItem[]): ApiRequest[] {
  const res: ApiRequest[] = [];
  for (const it of items) {
    if (it.type === 'request' && it.request) res.push(it.request);
    if (it.children) res.push(...collectReqs(it.children));
  }
  return res;
}

export const DependencyGraphView: React.FC = () => {
  const { collections } = useCollectionStore();
  const { specs } = useSpecStore();
  const { environments } = useEnvironmentStore();

  const requests = useMemo(() => collectReqs(collections), [collections]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const graph = useMemo(() => {
    void refreshTick;
    return buildDependencyGraph({ collections, requests, specs, environments });
  }, [collections, requests, specs, environments, refreshTick]);

  const handleSaveSnapshot = async () => {
    await db.dependencyGraphData.put(graph);
    setRefreshTick((t) => t + 1);
  };

  const filteredNodes = graph.nodes.filter(
    (n) =>
      !searchQuery.trim() ||
      n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.kind.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = graph.edges.filter(
    (e) => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId)
  );
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const svgHeight = Math.max(460, filteredNodes.reduce((m, n) => Math.max(m, n.y + 80), 460));

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <GitFork className="w-4 h-4 text-cyan-500" />
          <div>
            <h1 className="text-sm font-semibold">API Dependency Graph Analysis</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Structural mapping of APIs, collections, variables, hosts, and auth links (solid = explicit, dashed = inferred).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter nodes..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
          </div>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void handleSaveSnapshot()}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Analyze &amp; Save</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadFile(
                exportDependencyGraphAsMermaid(graph),
                `dependency-graph-${Date.now()}.mmd`,
                'text/plain'
              )
            }
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Mermaid</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadFile(
                JSON.stringify(graph, null, 2),
                `dependency-graph-${Date.now()}.json`,
                'application/json'
              )
            }
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <svg
            width={1180 * zoom}
            height={svgHeight * zoom}
            viewBox={`0 0 1180 ${svgHeight}`}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f141e]"
          >
            {filteredEdges.map((edge) => {
              const src = nodeMap.get(edge.sourceId);
              const tgt = nodeMap.get(edge.targetId);
              if (!src || !tgt) return null;
              return (
                <g key={edge.id}>
                  <line
                    x1={src.x + 80}
                    y1={src.y + 20}
                    x2={tgt.x - 10}
                    y2={tgt.y + 20}
                    stroke={edge.certainty === 'explicit' ? '#06b6d4' : '#f59e0b'}
                    strokeWidth={1.6}
                    strokeDasharray={edge.certainty === 'inferred' ? '5 4' : undefined}
                    opacity={0.75}
                  />
                </g>
              );
            })}
            {filteredNodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x - 10}, ${node.y})`}
                  onClick={() => setSelectedNodeId(node.id)}
                  className="cursor-pointer"
                >
                  <rect
                    width={175}
                    height={44}
                    rx={8}
                    fill={isSelected ? '#1d4ed8' : '#1e293b'}
                    stroke={isSelected ? '#38bdf8' : '#334155'}
                    strokeWidth={1.5}
                  />
                  <text x={10} y={18} fill="#e2e8f0" fontSize={11} fontWeight={600}>
                    {node.label.length > 22 ? `${node.label.slice(0, 20)}..` : node.label}
                  </text>
                  <text x={10} y={33} fill="#94a3b8" fontSize={10}>
                    {node.kind}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Node Inspector Drawer */}
        <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] p-4 overflow-y-auto text-xs space-y-3 shrink-0">
          <div className="font-semibold">Graph Summary</div>
          <div className="font-mono tabular-nums text-slate-500">
            Nodes: {graph.nodes.length} · Edges: {graph.edges.length}
          </div>
          {selectedNode ? (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="font-semibold text-sm">{selectedNode.label}</div>
              <div className="text-slate-500">
                Type: {selectedNode.kind} {selectedNode.subtitle ? `· ${selectedNode.subtitle}` : ''}
              </div>
              <div className="font-semibold pt-2">Connected Relationships</div>
              <div className="space-y-1.5">
                {graph.edges
                  .filter((e) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id)
                  .map((e) => (
                    <div
                      key={e.id}
                      className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                    >
                      <div className="font-mono">
                        {e.kind} ({e.certainty})
                      </div>
                      <div className="text-slate-500 mt-0.5">{e.evidence}</div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 pt-2">
              Click any node in the graph to inspect explicit and inferred dependencies.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
