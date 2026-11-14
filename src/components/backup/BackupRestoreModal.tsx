import React, { useState } from 'react';
import {
  X,
  HardDriveDownload,
  HardDriveUpload,
  ShieldAlert,
  Check,
  AlertTriangle,
  Layers,
  Sliders,
  Clock,
  Settings,
  Database,
  Download,
  Upload,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useVariableStore } from '../../stores/variableStore';
import { useHistoryStore } from '../../stores/historyStore';
import { backupService } from '../../services/storage/backupService';
import { BackupData } from '../../types';

export const BackupRestoreModal: React.FC = () => {
  const { isBackupRestoreModalOpen, setBackupRestoreModalOpen } = useAppStore();
  const { loadCollections } = useCollectionStore();
  const { loadEnvironments } = useEnvironmentStore();
  const { loadVariables } = useVariableStore();
  const { loadHistory } = useHistoryStore();

  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Restore state
  const [restoreInput, setRestoreInput] = useState('');
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [restoreEntities, setRestoreEntities] = useState({
    collections: true,
    environments: true,
    globalVariables: true,
    history: true,
    settings: true,
  });
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  if (!isBackupRestoreModalOpen) return null;

  const handleCreateBackup = async () => {
    setIsExporting(true);
    try {
      const backup = await backupService.createBackup({ includeSecrets });
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `api_studio_backup_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Backup failed: ' + String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRestoreInput(text);
      handleParseBackup(text);
    };
    reader.readAsText(file);
  };

  const handleParseBackup = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const validation = backupService.validateBackup(parsed);
      setParsedBackup(parsed);
      setValidationResult(validation);
      setRestoreSuccess(null);
    } catch {
      setParsedBackup(null);
      setValidationResult({ valid: false, errors: ['Selected file contains invalid JSON.'] });
    }
  };

  const handleExecuteRestore = async () => {
    if (!parsedBackup || !validationResult?.valid) return;

    if (restoreMode === 'overwrite') {
      const confirmed = window.confirm(
        'OVERWRITE MODE WARNING: Overwrite will replace existing data in the selected tables with the backup contents. Are you sure you wish to proceed?'
      );
      if (!confirmed) return;
    }

    setIsRestoring(true);
    try {
      await backupService.restoreBackup(parsedBackup, {
        mode: restoreMode,
        entities: restoreEntities,
      });

      // Reload all stores
      await Promise.all([
        loadCollections(),
        loadEnvironments(),
        loadVariables(),
        loadHistory(),
      ]);

      setRestoreSuccess('Application state restored successfully!');
      setRestoreInput('');
      setParsedBackup(null);
    } catch (err: any) {
      alert('Restore failed: ' + (err.message || String(err)));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl bg-[#121620] border border-blue-500/25 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Application Backup & Restore</h2>
              <p className="text-[11px] text-slate-400">
                Create full versioned snapshot archives or restore workspace state into IndexedDB.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBackupRestoreModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center px-5 border-b border-slate-800/80 bg-slate-950/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'backup'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>Create Backup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'restore'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDriveUpload className="w-3.5 h-3.5" />
            <span>Restore Backup</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'backup' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-blue-950/30 border border-blue-500/20 text-xs text-slate-300 leading-relaxed">
                A full backup serializes all collections, folders, requests, environments, global variables, request history, and application settings into a versioned JSON format.
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Included In Snapshot:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>Collections, Folders & Requests</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <span>Environments & Scoped Variables</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Global Variables Store</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Historical HTTP Executions</span>
                  </div>
                </div>
              </div>

              {/* Secret variables toggle */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                <input
                  type="checkbox"
                  id="backupIncludeSecrets"
                  checked={includeSecrets}
                  onChange={(e) => setIncludeSecrets(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="backupIncludeSecrets" className="text-slate-300 cursor-pointer flex-1">
                  Include secret variable values in the backup archive
                </label>
                {includeSecrets && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Unmasked Secrets Included
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {restoreSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{restoreSuccess}</span>
                </div>
              )}

              {/* Upload picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">Select Backup Archive</label>
                  <label className="text-[11px] text-cyan-400 hover:underline cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    <span>Choose backup .json</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={restoreInput}
                  onChange={(e) => {
                    setRestoreInput(e.target.value);
                    handleParseBackup(e.target.value);
                  }}
                  placeholder="Paste JSON backup payload here or select a file above..."
                  className="w-full px-3 py-2 text-[11px] font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Validation & Metadata Inspection */}
              {parsedBackup && (
                <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      Backup Created: {new Date(parsedBackup.metadata.createdAt).toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-600/20 text-cyan-300 border border-blue-500/30">
                      Schema v{parsedBackup.version}
                    </span>
                  </div>

                  {validationResult && !validationResult.valid && (
                    <div className="p-2.5 rounded bg-red-950/30 border border-red-500/30 text-red-300 text-[11px] space-y-1">
                      {validationResult.errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selective checkboxes */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Selective Entity Restoration
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restoreEntities.collections}
                          onChange={(e) =>
                            setRestoreEntities({ ...restoreEntities, collections: e.target.checked })
                          }
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                        />
                        <span>Collections ({parsedBackup.collections?.length || 0})</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restoreEntities.environments}
                          onChange={(e) =>
                            setRestoreEntities({ ...restoreEntities, environments: e.target.checked })
                          }
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                        />
                        <span>Environments ({parsedBackup.environments?.length || 0})</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restoreEntities.globalVariables}
                          onChange={(e) =>
                            setRestoreEntities({ ...restoreEntities, globalVariables: e.target.checked })
                          }
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                        />
                        <span>Global Variables ({parsedBackup.globalVariables?.length || 0})</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restoreEntities.history}
                          onChange={(e) =>
                            setRestoreEntities({ ...restoreEntities, history: e.target.checked })
                          }
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                        />
                        <span>History ({parsedBackup.history?.length || 0})</span>
                      </label>
                    </div>
                  </div>

                  {/* Mode radio */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Conflict Resolution Mode
                    </label>
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="restoreMode"
                          value="merge"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="text-cyan-500 focus:ring-0"
                        />
                        <span>Merge (Keep existing, add new)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-amber-300">
                        <input
                          type="radio"
                          name="restoreMode"
                          value="overwrite"
                          checked={restoreMode === 'overwrite'}
                          onChange={() => setRestoreMode('overwrite')}
                          className="text-amber-500 focus:ring-0"
                        />
                        <span>Overwrite (Clear selected tables first)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/80 bg-slate-900/50">
          <span className="text-[11px] text-slate-500 font-mono">
            {activeTab === 'backup' ? 'IndexedDB Snapshot' : 'Dexie Transaction Engine'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBackupRestoreModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Close
            </button>
            {activeTab === 'backup' ? (
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isExporting}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Exporting...' : 'Download Full Backup'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!parsedBackup || !validationResult?.valid || isRestoring}
                onClick={handleExecuteRestore}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isRestoring ? 'Restoring...' : 'Restore State'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
