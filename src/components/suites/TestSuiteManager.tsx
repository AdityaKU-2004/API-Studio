import React, { useState } from 'react';
import { FlaskConical, Plus, Copy, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { useTestSuiteStore } from '../../stores/testSuiteStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { TestSuiteEditor } from './TestSuiteEditor';

export const TestSuiteManager: React.FC = () => {
  const {
    suites,
    activeSuiteId,
    setActiveSuiteId,
    createSuite,
    duplicateSuite,
    deleteSuite,
  } = useTestSuiteStore();
  const { activeEnvironmentId } = useEnvironmentStore();
  const [search, setSearch] = useState('');

  const filtered = suites.filter(
    (s) =>
      !search.trim() ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.folder || '').toLowerCase().includes(search.toLowerCase())
  );

  const activeSuite = suites.find((s) => s.id === activeSuiteId) || filtered[0] || null;

  const handleCreate = async () => {
    await createSuite({
      name: `Test Suite ${suites.length + 1}`,
      environmentId: activeEnvironmentId,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#11151e] dark:bg-[#11151e] light:bg-white text-slate-200 dark:text-slate-200 light:text-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <FlaskConical className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold">Test Suites</h1>
            <p className="text-[11px] text-slate-400">
              Reusable automated test suites persisted in IndexedDB
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Test Suite</span>
        </button>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left List */}
        <div className="w-72 border-r border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/70 dark:border-slate-800/70 light:border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter test suites..."
                className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-200 text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No test suites created yet. Click &ldquo;New Test Suite&rdquo; to create one.
              </div>
            ) : (
              filtered.map((suite) => {
                const isSelected = activeSuite?.id === suite.id;
                return (
                  <div
                    key={suite.id}
                    onClick={() => setActiveSuiteId(suite.id)}
                    className={`p-2.5 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/40'
                        : 'border-transparent hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {suite.lastRunStatus === 'passed' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        {suite.lastRunStatus === 'failed' && (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="text-xs font-medium truncate">{suite.name}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateSuite(suite.id);
                          }}
                          title="Duplicate suite"
                          className="p-1 text-slate-500 hover:text-cyan-400 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSuite(suite.id);
                          }}
                          title="Delete suite"
                          className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                      <span>{suite.folder || 'General'}</span>
                      <span>{suite.requestIds.length} requests</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Editor */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeSuite ? (
            <TestSuiteEditor suite={activeSuite} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 space-y-3 p-8">
              <FlaskConical className="w-10 h-10 text-slate-600 stroke-1" />
              <p>Create a reusable test suite to bundle requests, environments, and assertions.</p>
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
              >
                Create First Test Suite
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
