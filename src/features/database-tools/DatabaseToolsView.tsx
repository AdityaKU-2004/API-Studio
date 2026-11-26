import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Database,
  Play,
  Square,
  Download,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { DatabaseConnectionProfile, DatabaseEngineType } from '../../types';
import { useDbToolsStore } from '../../stores/dbToolsStore';
import { useUiStore } from '../../stores/uiStore';
import {
  exportQueryResultAsCsv,
  formatSqlKeywords,
  isDestructiveSql,
  isReadOnlySql,
} from '../../services/database/dbToolsService';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

export const DatabaseToolsView: React.FC = () => {
  const { theme } = useUiStore();
  const {
    profiles,
    activeProfileId,
    schemaSnapshot,
    queryHistory,
    lastResult,
    isExecuting,
    isInspecting,
    statusMessage,
    error,
    selectProfile,
    saveProfile,
    deleteProfile,
    testConnection,
    inspectSchema,
    runQuery,
    cancelActiveQuery,
  } = useDbToolsStore();

  const [name, setName] = useState('Local SQLite DB');
  const [engine, setEngine] = useState<DatabaseEngineType>('sqlite');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState<number>(5432);
  const [databaseName, setDatabaseName] = useState('');
  const [username, setUsername] = useState('');
  const [plainPassword, setPlainPassword] = useState('');

  const [sql, setSql] = useState('SELECT name, type FROM sqlite_master LIMIT 50;');
  const [readOnly, setReadOnly] = useState(true);
  const [maxRows, setMaxRows] = useState(200);
  const [timeoutMs, setTimeoutMs] = useState(15000);
  const [confirmDestructiveModal, setConfirmDestructiveModal] = useState(false);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const profile: DatabaseConnectionProfile = {
      id: `dbp-${Date.now()}`,
      name: name.trim() || 'Database Profile',
      engine,
      host: engine === 'sqlite' ? undefined : host.trim(),
      port: engine === 'sqlite' ? undefined : port,
      databaseName: databaseName.trim(),
      username: engine === 'sqlite' ? undefined : username.trim(),
      readOnlyDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveProfile(profile, plainPassword || undefined);
    setPlainPassword('');
  };

  const handleExecuteQuery = async (confirmDestructive = false) => {
    if (!activeProfile) return;
    setConfirmDestructiveModal(false);

    if (!readOnly && isDestructiveSql(sql) && !confirmDestructive) {
      setConfirmDestructiveModal(true);
      return;
    }

    await runQuery({
      profile: activeProfile,
      sql,
      readOnly,
      confirmDestructive,
      maxRows,
      timeoutMs,
    });
  };

  const downloadCsv = () => {
    if (!lastResult) return;
    const csv = exportQueryResultAsCsv(lastResult);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0d111a] text-slate-900 dark:text-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-blue-500" />
          <div>
            <h1 className="text-sm font-semibold">Database Development Tools</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              SQLite, PostgreSQL &amp; MySQL schema explorer and SQL runner (credentials stored in OS Keyring).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
            />
            <span>Read-Only Guard</span>
          </label>
          <button
            type="button"
            onClick={() => setSql(formatSqlKeywords(sql))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Format SQL</span>
          </button>
          {isExecuting ? (
            <button
              type="button"
              onClick={() => void cancelActiveQuery()}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!activeProfile || (readOnly && !isReadOnlySql(sql))}
              onClick={() => void handleExecuteQuery(false)}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Query</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Connection Profiles & Schema Explorer */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141f] p-4 overflow-y-auto space-y-4 shrink-0 text-xs">
          <form onSubmit={handleSaveProfile} className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="font-semibold">New Connection Profile</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Profile name"
              className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <select
              value={engine}
              onChange={(e) => {
                const next = e.target.value as DatabaseEngineType;
                setEngine(next);
                setPort(next === 'mysql' ? 3306 : 5432);
              }}
              className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              <option value="sqlite">SQLite (File)</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL / MariaDB</option>
            </select>
            {engine !== 'sqlite' && (
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="Host"
                  className="col-span-2 px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder="Port"
                  className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
            )}
            <input
              type="text"
              value={databaseName}
              onChange={(e) => setDatabaseName(e.target.value)}
              placeholder={engine === 'sqlite' ? '/path/to/database.db' : 'Database name'}
              className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
            />
            {engine !== 'sqlite' && (
              <>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <input
                  type="password"
                  value={plainPassword}
                  onChange={(e) => setPlainPassword(e.target.value)}
                  placeholder="Password (saved in OS Keyring)"
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </>
            )}
            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-blue-600 text-white font-medium cursor-pointer"
            >
              Save Connection Profile
            </button>
          </form>

          <div className="space-y-1.5">
            <div className="font-semibold">Profiles ({profiles.length})</div>
            {profiles.map((p) => (
              <div
                key={p.id}
                onClick={() => selectProfile(p.id)}
                className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between gap-2 ${
                  activeProfile?.id === p.id
                    ? 'border-cyan-500/50 bg-blue-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {p.engine} · {p.databaseName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteProfile(p.id);
                  }}
                  className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {activeProfile && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void testConnection(activeProfile)}
                  className="flex-1 py-1.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Test Connection
                </button>
                <button
                  type="button"
                  disabled={isInspecting}
                  onClick={() => void inspectSchema(activeProfile)}
                  className="flex-1 py-1.5 rounded border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isInspecting ? 'animate-spin' : ''}`} />
                  <span>Schema</span>
                </button>
              </div>
            )}
          </div>

          {schemaSnapshot && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="font-semibold">
                Schema Explorer ({schemaSnapshot.tables.length} tables)
              </div>
              {schemaSnapshot.tables.map((t) => (
                <details key={`${t.schemaName}.${t.tableName}`} className="border border-slate-200 dark:border-slate-800 rounded p-2">
                  <summary className="font-mono font-medium cursor-pointer">
                    {t.tableName} ({t.columns.length})
                  </summary>
                  <div className="mt-1.5 space-y-1 pl-2 text-[11px] text-slate-500 font-mono">
                    {t.columns.map((c) => (
                      <div key={c.name} className="flex justify-between gap-2">
                        <span>
                          {c.name} {c.isPrimaryKey ? 'PK' : ''}
                        </span>
                        <span>{c.dataType}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Right: SQL Editor & Result Grid */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
          {statusMessage && (
            <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500">
              {statusMessage}
            </div>
          )}
          {error && (
            <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-500">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <span>Max Rows:</span>
              <input
                type="number"
                min={1}
                max={5000}
                value={maxRows}
                onChange={(e) => setMaxRows(Number(e.target.value))}
                className="w-20 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span>Timeout (ms):</span>
              <input
                type="number"
                min={1000}
                max={60000}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                className="w-24 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono tabular-nums"
              />
            </label>
          </div>

          <div className="h-48 rounded-lg border border-slate-300 dark:border-slate-800 overflow-hidden">
            <Editor
              height="100%"
              language="sql"
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              value={sql}
              onChange={(v) => setSql(v || '')}
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          </div>

          <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#111622] overflow-hidden">
            <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono tabular-nums">
                {lastResult
                  ? `${lastResult.rowCount} rows · ${lastResult.durationMs}ms${
                      lastResult.truncated ? ' (truncated)' : ''
                    }`
                  : 'Query Results'}
              </span>
              {lastResult && (
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto p-2 text-xs">
              {lastResult && lastResult.columns.length > 0 ? (
                <table className="w-full border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left">
                      {lastResult.columns.map((c) => (
                        <th key={c} className="p-2 font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lastResult.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-slate-100 dark:border-slate-800/50"
                      >
                        {lastResult.columns.map((c) => (
                          <td key={c} className="p-2 whitespace-nowrap max-w-xs truncate">
                            {row[c] === null ? 'NULL' : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-slate-500">
                  {lastResult?.affectedRows !== undefined
                    ? `Statement succeeded. Affected rows: ${lastResult.affectedRows}`
                    : `Select a profile and run a SQL query. Recent queries executed: ${queryHistory.length}.`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmDestructiveModal}
        onClose={() => setConfirmDestructiveModal(false)}
        onConfirm={() => void handleExecuteQuery(true)}
        title="Confirm Destructive SQL Execution"
        message="This SQL statement modifies schema or deletes/updates records without a WHERE clause. Are you sure you want to execute it?"
      />
    </div>
  );
};
