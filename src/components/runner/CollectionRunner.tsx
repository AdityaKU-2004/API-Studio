import React from 'react';
import { PlayCircle } from 'lucide-react';
import { RunnerConfiguration } from './RunnerConfiguration';
import { RunnerProgress } from './RunnerProgress';
import { RunnerResults } from './RunnerResults';
import { useRunnerStore } from '../../stores/runnerStore';

interface CollectionRunnerProps {
  onCloseModal?: () => void;
}

export const CollectionRunner: React.FC<CollectionRunnerProps> = ({ onCloseModal }) => {
  const { sourceName, sourceType } = useRunnerStore();

  return (
    <div className="flex flex-col h-full bg-[#11151e] dark:bg-[#11151e] light:bg-white text-slate-200 dark:text-slate-200 light:text-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <PlayCircle className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold">Collection Runner</h1>
            <p className="text-[11px] text-slate-400">
              Active target: {sourceName} ({sourceType})
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 max-w-5xl w-full mx-auto">
        <RunnerConfiguration />
        <RunnerProgress />
        <RunnerResults onOpenReport={onCloseModal} />
      </div>
    </div>
  );
};
