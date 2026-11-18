import React from 'react';
import { Play, BarChart3, CheckSquare, Square } from 'lucide-react';
import { ApiRequest, CollectionItem, FailureHandlingMode, TestSuite } from '../../types';
import { useCollectionStore } from '../../stores/collectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useTestSuiteStore } from '../../stores/testSuiteStore';
import { useRunnerStore } from '../../stores/runnerStore';
import { useReportStore } from '../../stores/reportStore';
import { useAppStore } from '../../stores/appStore';
import { AssertionList } from '../testing/AssertionList';
import { MethodBadge } from '../common/MethodBadge';

interface TestSuiteEditorProps {
  suite: TestSuite;
}

function collectAllRequests(items: CollectionItem[]): { collectionName: string; req: ApiRequest }[] {
  const out: { collectionName: string; req: ApiRequest }[] = [];
  const walk = (nodes: CollectionItem[], colName: string) => {
    for (const n of nodes) {
      if (n.type === 'collection') {
        if (n.children) walk(n.children, n.name);
      } else if (n.type === 'folder') {
        if (n.children) walk(n.children, colName);
      } else if (n.type === 'request' && n.request) {
        out.push({ collectionName: colName, req: n.request });
      }
    }
  };
  walk(items, 'Collection');
  return out;
}

export const TestSuiteEditor: React.FC<TestSuiteEditorProps> = ({ suite }) => {
  const { collections } = useCollectionStore();
  const { environments } = useEnvironmentStore();
  const { updateSuite } = useTestSuiteStore();
  const { loadFromSuite } = useRunnerStore();
  const { selectReport } = useReportStore();
  const { setActiveView } = useAppStore();

  const availableRequests = collectAllRequests(collections);

  const handleToggleRequest = (reqId: string) => {
    const exists = suite.requestIds.includes(reqId);
    const nextIds = exists
      ? suite.requestIds.filter((id) => id !== reqId)
      : [...suite.requestIds, reqId];
    updateSuite(suite.id, { requestIds: nextIds });
  };

  const handleRunSuite = () => {
    loadFromSuite(suite);
    setActiveView('runner');
  };

  return (
    <div className="p-5 space-y-5 overflow-y-auto h-full text-xs">
      {/* Header & Run Actions */}
      <div className="flex items-start justify-between flex-wrap gap-3 pb-3 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
        <div className="space-y-1 flex-1 min-w-[240px]">
          <input
            type="text"
            value={suite.name}
            onChange={(e) => updateSuite(suite.id, { name: e.target.value })}
            className="text-base font-semibold bg-transparent border-b border-transparent focus:border-cyan-500/50 focus:outline-none w-full text-slate-100 dark:text-slate-100 light:text-slate-900"
          />
          <input
            type="text"
            value={suite.description}
            onChange={(e) => updateSuite(suite.id, { description: e.target.value })}
            placeholder="Suite description..."
            className="text-xs text-slate-400 bg-transparent border-b border-transparent focus:border-cyan-500/50 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          {suite.lastRunReportId && (
            <button
              type="button"
              onClick={() => {
                selectReport(suite.lastRunReportId!);
                setActiveView('reports');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:text-cyan-300 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>View Last Report</span>
            </button>
          )}
          <button
            type="button"
            disabled={suite.requestIds.length === 0}
            onClick={handleRunSuite}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Open in Runner ({suite.requestIds.length})</span>
          </button>
        </div>
      </div>

      {/* Suite Configuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Group / Folder</label>
          <input
            type="text"
            value={suite.folder || ''}
            onChange={(e) => updateSuite(suite.id, { folder: e.target.value })}
            placeholder="General"
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Environment</label>
          <select
            value={suite.environmentId || ''}
            onChange={(e) => updateSuite(suite.id, { environmentId: e.target.value || null })}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300"
          >
            <option value="">No Environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Iterations</label>
          <input
            type="number"
            min={1}
            max={200}
            value={suite.iterations}
            onChange={(e) =>
              updateSuite(suite.id, { iterations: Math.max(1, Number(e.target.value) || 1) })
            }
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Delay (ms)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={suite.delayMs}
            onChange={(e) =>
              updateSuite(suite.id, { delayMs: Math.max(0, Number(e.target.value) || 0) })
            }
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">On Failure</label>
          <select
            value={suite.failureMode}
            onChange={(e) =>
              updateSuite(suite.id, { failureMode: e.target.value as FailureHandlingMode })
            }
            className="w-full px-2.5 py-1.5 rounded bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300"
          >
            <option value="continue">Continue run</option>
            <option value="stop">Stop on failure</option>
          </select>
        </div>
      </div>

      {/* Included Requests Selector */}
      <div className="rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 overflow-hidden">
        <div className="px-3.5 py-2 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 bg-slate-900/50 dark:bg-slate-900/50 light:bg-slate-50 flex items-center justify-between">
          <span className="font-semibold">
            Suite Requests ({suite.requestIds.length} selected)
          </span>
          <span className="text-[11px] text-slate-400">
            Select endpoints across any collection
          </span>
        </div>

        <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 dark:divide-slate-800/60 light:divide-slate-200">
          {availableRequests.map(({ collectionName, req }) => {
            const checked = suite.requestIds.includes(req.id);
            return (
              <div
                key={req.id}
                onClick={() => handleToggleRequest(req.id)}
                className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-slate-800/30 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <MethodBadge method={req.method} size="sm" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{req.name}</div>
                    <div className="font-mono text-[10px] text-slate-400 truncate">{req.url}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {collectionName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shared Suite-Level Assertions */}
      <div className="rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 overflow-hidden">
        <div className="px-3.5 py-2 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 bg-slate-900/50 dark:bg-slate-900/50 light:bg-slate-50 font-semibold">
          Suite-Wide Assertions (applied to every request in this suite)
        </div>
        <AssertionList
          customRules={suite.assertions}
          onChangeRules={(rules) => updateSuite(suite.id, { assertions: rules })}
        />
      </div>
    </div>
  );
};
