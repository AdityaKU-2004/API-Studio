import React, { useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useDesktopStore } from '../../stores/desktopStore';

export const SqliteMigrationModal: React.FC = () => {
  const {
    isMigrationModalOpen,
    setMigrationModalOpen,
    indexedDbSummary,
    migrationStatus,
    migrationProgressLabel,
    migrationReport,
    migrationError,
    runIndexedDbMigration,
  } = useDesktopStore();

  const [createBackupFirst, setCreateBackupFirst] = useState(true);
  const [conflictStrategy, setConflictStrategy] = useState<'overwrite' | 'skip'>('overwrite');

  if (!isMigrationModalOpen) return null;

  const isRunning = migrationStatus === 'backing-up' || migrationStatus === 'migrating';

  return (
    <Modal
      isOpen={isMigrationModalOpen}
      onClose={() => {
        if (!isRunning) setMigrationModalOpen(false);
      }}
      title="Migrate Workspace Data to SQLite"
      description="Transfer your existing browser IndexedDB workspace into native desktop SQLite storage"
      maxWidth="xl"
    >
      <div className="space-y-4 text-xs">
        <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/25 flex items-start gap-3">
          <Database className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-slate-100">
              Legacy IndexedDB Data Detected ({indexedDbSummary?.totalRecords ?? 0} records)
            </div>
            <p className="text-slate-400 leading-relaxed">
              API Studio Desktop stores collections, requests, environments, history, test suites,
              and protocol configurations in a fast local SQLite database. Your original IndexedDB
              records remain untouched until you verify and confirm migration.
            </p>
          </div>
        </div>

        {indexedDbSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Collections', indexedDbSummary.counts.collections],
              ['Folders', indexedDbSummary.counts.folders],
              ['Requests', indexedDbSummary.counts.requests],
              ['Environments', indexedDbSummary.counts.environments],
              ['History', indexedDbSummary.counts.history],
              ['Test Suites', indexedDbSummary.counts.testSuites],
              ['Test Reports', indexedDbSummary.counts.testReports],
              ['Schemas / Scripts', indexedDbSummary.counts.jsonSchemas + indexedDbSummary.counts.scriptTemplates],
            ].map(([label, count]) => (
              <div
                key={String(label)}
                className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800"
              >
                <div className="text-[10px] text-slate-500">{label}</div>
                <div className="text-sm font-mono font-bold text-cyan-300 tabular-nums mt-0.5">
                  {count}
                </div>
              </div>
            ))}
          </div>
        )}

        {migrationStatus !== 'completed' && (
          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer">
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-200">
                    Export pre-migration safety backup first
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Save a JSON archive snapshot via native Save dialog before writing to SQLite
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={createBackupFirst}
                onChange={(e) => setCreateBackupFirst(e.target.checked)}
                disabled={isRunning}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
            </label>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div>
                <div className="font-medium text-slate-200">Duplicate Record Handling</div>
                <div className="text-[11px] text-slate-500">
                  Choose behavior if an ID already exists in SQLite
                </div>
              </div>
              <select
                value={conflictStrategy}
                onChange={(e) => setConflictStrategy(e.target.value as 'overwrite' | 'skip')}
                disabled={isRunning}
                className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-200"
              >
                <option value="overwrite">Upsert / Update existing</option>
                <option value="skip">Skip existing IDs</option>
              </select>
            </div>
          </div>
        )}

        {isRunning && (
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-2.5 text-cyan-200">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>{migrationProgressLabel}</span>
          </div>
        )}

        {migrationStatus === 'error' && migrationError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Migration Error (No SQLite changes committed)</div>
              <div className="text-[11px] text-rose-300 mt-0.5">{migrationError}</div>
            </div>
          </div>
        )}

        {migrationStatus === 'completed' && migrationReport && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>SQLite Migration Verified ({migrationReport.durationMs}ms)</span>
            </div>
            <p className="text-[11px] text-slate-300">
              All records were committed inside an atomic SQLite transaction and verified on disk.
              Your browser IndexedDB data remains preserved as a fallback.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          {migrationStatus !== 'completed' ? (
            <>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setMigrationModalOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/60 cursor-pointer disabled:opacity-50"
              >
                Remind Me Later
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() =>
                  runIndexedDbMigration({ createBackupFirst, conflictStrategy })
                }
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:brightness-110 cursor-pointer disabled:opacity-50"
              >
                {migrationStatus === 'error' ? 'Retry Migration' : 'Migrate to SQLite'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMigrationModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
            >
              Finish & Continue
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
