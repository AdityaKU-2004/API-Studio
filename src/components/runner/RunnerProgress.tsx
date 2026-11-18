import React from 'react';
import { Play, Pause, Square, RotateCcw, Clock } from 'lucide-react';
import { useRunnerStore } from '../../stores/runnerStore';

export const RunnerProgress: React.FC = () => {
  const { config, progress, startRun, pauseRun, resumeRun, stopRun, restartRun } =
    useRunnerStore();

  const status = progress?.status || 'idle';
  const enabledCount = config.requests.filter((r) => r.enabled).length;
  const isRunning = status === 'running';
  const isPaused = status === 'paused';

  return (
    <div className="p-4 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/50 dark:bg-slate-900/50 light:bg-slate-50 space-y-3 text-xs">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {!isRunning && !isPaused ? (
            <button
              type="button"
              disabled={enabledCount === 0}
              onClick={() => startRun()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Run ({enabledCount} req)</span>
            </button>
          ) : (
            <>
              {isRunning ? (
                <button
                  type="button"
                  onClick={pauseRun}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 font-medium cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeRun}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 font-medium cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              )}

              <button
                type="button"
                onClick={stopRun}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 font-medium cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            </>
          )}

          {progress && (
            <button
              type="button"
              onClick={() => restartRun()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-cyan-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart</span>
            </button>
          )}
        </div>

        {progress && (
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="uppercase text-cyan-400 font-semibold">{progress.status}</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {progress.elapsedMs}ms
            </span>
          </div>
        )}
      </div>

      {progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 dark:text-slate-300 light:text-slate-700">
              Iteration {progress.currentIteration}/{progress.totalIterations}
              {progress.currentRequestName ? ` · Running: ${progress.currentRequestName}` : ''}
            </span>
            <span className="font-mono text-cyan-400 font-semibold">
              {progress.completedExecutions}/{progress.totalExecutions} ({progress.percentage}%)
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-slate-800 dark:bg-slate-800 light:bg-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                progress.failedRequests > 0 ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <div className="flex items-center gap-5 font-mono text-[11px] pt-1">
            <span className="text-emerald-400">
              Requests Passed: <strong>{progress.passedRequests}</strong>
            </span>
            <span className="text-red-400">
              Requests Failed: <strong>{progress.failedRequests}</strong>
            </span>
            <span className="text-emerald-400">
              Assertions Passed: <strong>{progress.passedAssertions}</strong>
            </span>
            <span className="text-red-400">
              Assertions Failed: <strong>{progress.failedAssertions}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
