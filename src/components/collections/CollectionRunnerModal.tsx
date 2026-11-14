import React, { useMemo } from 'react';
import { X, Play, Clock, AlertCircle, Layers, CheckCircle2, ListOrdered, Sparkles } from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { CollectionItem } from '../../types';
import { MethodBadge } from '../common/MethodBadge';

export const CollectionRunnerModal: React.FC = () => {
  const { isRunnerModalOpen, runnerTargetCollectionId, setRunnerModalOpen, collections } = useCollectionStore();

  const targetCollection = useMemo(() => {
    if (!runnerTargetCollectionId) return null;
    return collections.find((c) => c.id === runnerTargetCollectionId) || null;
  }, [collections, runnerTargetCollectionId]);

  // Recursively collect all requests in the collection
  const collectedRequests = useMemo(() => {
    if (!targetCollection) return [];
    const requests: { id: string; name: string; method: string; url: string; folderName?: string }[] = [];

    const traverse = (items: CollectionItem[], currentFolderName?: string) => {
      for (const item of items) {
        if (item.type === 'request' && item.request) {
          requests.push({
            id: item.request.id,
            name: item.request.name,
            method: item.request.method,
            url: item.request.url,
            folderName: currentFolderName,
          });
        } else if (item.children && item.children.length > 0) {
          traverse(item.children, item.type === 'folder' ? item.name : currentFolderName);
        }
      }
    };

    if (targetCollection.children) {
      traverse(targetCollection.children);
    }

    return requests;
  }, [targetCollection]);

  if (!isRunnerModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-xl bg-[#121620] border border-blue-500/25 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <Play className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Collection Runner
              </h2>
              <p className="text-[11px] text-slate-400">
                {targetCollection ? targetCollection.name : 'All Requests'} · {collectedRequests.length} requests queued
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRunnerModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Banner */}
        <div className="mx-5 mt-4 p-3.5 rounded-lg bg-gradient-to-r from-blue-900/40 via-cyan-900/20 to-blue-950/40 border border-cyan-500/30 text-xs text-slate-200 flex items-start gap-3 shadow-lg">
          <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-cyan-300 mb-0.5">Automated Execution Pipeline</div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Collection Runner will be available in a future release. It will execute the sequential pipeline with environment variable passing, automated test assertions, and exportable run summaries.
            </p>
          </div>
        </div>

        {/* Runner configuration preview */}
        <div className="px-5 pt-3 pb-1 grid grid-cols-3 gap-3">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Iterations</div>
            <div className="text-xs font-semibold text-slate-200">1 run</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Delay</div>
            <div className="text-xs font-semibold text-slate-200">0 ms</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Data File</div>
            <div className="text-xs font-semibold text-slate-400">None selected</div>
          </div>
        </div>

        {/* Requests Queue */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pb-1">
            <span className="flex items-center gap-1.5">
              <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
              <span>Execution Order ({collectedRequests.length})</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">Sequential</span>
          </div>

          {collectedRequests.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800">
              No requests found in this collection.
            </div>
          ) : (
            collectedRequests.map((req, idx) => (
              <div
                key={req.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-4 font-mono text-[10px] text-slate-500">{idx + 1}</span>
                  <MethodBadge method={req.method as any} size="sm" />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">{req.name}</div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">{req.url}</div>
                  </div>
                </div>
                {req.folderName && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                    {req.folderName}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/80 bg-slate-900/50">
          <span className="text-[11px] text-slate-500 font-mono">Phase 5 Feature Preview</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRunnerModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600/50 text-slate-300 opacity-60 cursor-not-allowed flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Collection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
