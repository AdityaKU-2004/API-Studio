import React, { useEffect } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRunnerStore } from '../../stores/runnerStore';
import { useAppStore } from '../../stores/appStore';
import { CollectionRunner } from '../runner/CollectionRunner';

export const CollectionRunnerModal: React.FC = () => {
  const { isRunnerModalOpen, runnerTargetCollectionId, setRunnerModalOpen } = useCollectionStore();
  const { loadFromCollection } = useRunnerStore();
  const { setActiveView } = useAppStore();

  useEffect(() => {
    if (isRunnerModalOpen && runnerTargetCollectionId) {
      loadFromCollection(runnerTargetCollectionId);
    }
  }, [isRunnerModalOpen, runnerTargetCollectionId, loadFromCollection]);

  if (!isRunnerModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-xl bg-[#121620] dark:bg-[#121620] light:bg-white border border-blue-500/25 shadow-2xl flex flex-col h-[88vh] overflow-hidden text-slate-200 dark:text-slate-200 light:text-slate-800 relative">
        <div className="absolute right-4 top-3.5 flex items-center gap-2 z-10">
          <button
            type="button"
            onClick={() => {
              setRunnerModalOpen(false);
              setActiveView('runner');
            }}
            title="Open Full Collection Runner Workspace"
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 text-xs text-slate-300 hover:text-cyan-300 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Full View</span>
          </button>
          <button
            type="button"
            onClick={() => setRunnerModalOpen(false)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <CollectionRunner onCloseModal={() => setRunnerModalOpen(false)} />
      </div>
    </div>
  );
};
