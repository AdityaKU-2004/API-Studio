import React, { useState, useRef } from 'react';
import {
  FileJson,
  Upload,
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  Play,
  Plus,
} from 'lucide-react';
import { SchemaValidationResult } from '../../types';
import { useRequestStore } from '../../stores/requestStore';
import { useTestingStore } from '../../stores/testingStore';
import { schemaValidator } from '../../services/testing/schemaValidator';

interface SchemaValidatorProps {
  mode?: 'request' | 'library';
}

export const SchemaValidator: React.FC<SchemaValidatorProps> = ({ mode = 'request' }) => {
  const { tabs, activeTabId, activeResponse, updateActiveRequest } = useRequestStore();
  const { schemas, saveSchema, deleteSchema } = useTestingStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(schemas[0]?.id || '');
  const [newSchemaName, setNewSchemaName] = useState('');
  const [newSchemaDesc, setNewSchemaDesc] = useState('');
  const [libraryDraftText, setLibraryDraftText] = useState(schemas[0]?.schemaText || '{\n  "type": "object",\n  "required": ["id"],\n  "properties": {\n    "id": { "type": "number" }\n  }\n}');
  const [manualValidation, setManualValidation] = useState<SchemaValidationResult | null>(null);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'request' | 'library') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      if (target === 'request' && request) {
        updateActiveRequest({
          schemaValidation: {
            enabled: true,
            inlineSchema: content,
          },
        });
      } else {
        setLibraryDraftText(content);
        if (!newSchemaName) setNewSchemaName(file.name.replace(/\.json$/i, ''));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (mode === 'library') {
    const currentSchema = schemas.find((s) => s.id === selectedLibraryId);

    const handleSelectSaved = (id: string) => {
      setSelectedLibraryId(id);
      const found = schemas.find((s) => s.id === id);
      if (found) {
        setNewSchemaName(found.name);
        setNewSchemaDesc(found.description || '');
        setLibraryDraftText(found.schemaText);
        setSyntaxError(null);
      }
    };

    const handleSaveToLibrary = async () => {
      const check = schemaValidator.parseSchema(libraryDraftText);
      if (!check.valid) {
        setSyntaxError(check.error || 'Invalid JSON Schema');
        return;
      }
      setSyntaxError(null);
      const id = currentSchema?.id || `schema-${Date.now()}`;
      await saveSchema({
        id,
        name: newSchemaName.trim() || 'Untitled Schema',
        description: newSchemaDesc.trim(),
        schemaText: libraryDraftText,
      });
      setSelectedLibraryId(id);
    };

    const handleNewSchema = () => {
      setSelectedLibraryId('');
      setNewSchemaName('New JSON Schema');
      setNewSchemaDesc('');
      setLibraryDraftText('{\n  "type": "object",\n  "required": [],\n  "properties": {}\n}');
      setSyntaxError(null);
    };

    return (
      <div className="flex flex-col h-full bg-[#11151e] dark:bg-[#11151e] light:bg-white text-slate-200 dark:text-slate-200 light:text-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
          <div className="flex items-center gap-2.5">
            <FileJson className="w-5 h-5 text-cyan-400" />
            <div>
              <h1 className="text-sm font-semibold">JSON Schema Registry</h1>
              <p className="text-[11px] text-slate-400">
                Create, import, and reuse Ajv JSON Schemas across API requests
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => handleFileUpload(e, 'library')}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 text-xs hover:text-cyan-300 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import .json</span>
            </button>
            <button
              type="button"
              onClick={handleNewSchema}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Schema</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="w-72 border-r border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 overflow-y-auto p-2 space-y-1">
            {schemas.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-md border cursor-pointer ${
                  s.id === selectedLibraryId
                    ? 'bg-blue-600/15 border-blue-500/40'
                    : 'border-transparent hover:bg-slate-800/40'
                }`}
                onClick={() => handleSelectSaved(s.id)}
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {s.description || 'Reusable JSON Schema'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSchema(s.id);
                  }}
                  className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 max-w-3xl">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Schema Name</label>
                <input
                  type="text"
                  value={newSchemaName}
                  onChange={(e) => setNewSchemaName(e.target.value)}
                  placeholder="User Response Schema"
                  className="w-full px-3 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-700 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newSchemaDesc}
                  onChange={(e) => setNewSchemaDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-100 border border-slate-700 text-xs"
                />
              </div>
            </div>

            <div className="max-w-3xl space-y-2">
              <label className="block text-[11px] text-slate-400">Schema Definition (JSON Schema Draft-07+)</label>
              <textarea
                rows={16}
                value={libraryDraftText}
                onChange={(e) => setLibraryDraftText(e.target.value)}
                className="w-full p-3 rounded bg-[#0c1018] border border-slate-700 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
              />
              {syntaxError && (
                <div className="text-xs text-red-400 font-mono">{syntaxError}</div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveToLibrary}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Schema</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const cfg = request.schemaValidation || { enabled: false, inlineSchema: '' };
  const activeSavedSchema = cfg.schemaId ? schemas.find((s) => s.id === cfg.schemaId) : undefined;
  const effectiveSchemaText = activeSavedSchema ? activeSavedSchema.schemaText : cfg.inlineSchema || '';

  const handleValidateNow = () => {
    if (!activeResponse || !effectiveSchemaText.trim()) return;
    const res = schemaValidator.validateResponse(
      activeResponse,
      effectiveSchemaText,
      activeSavedSchema?.name || 'Inline Schema'
    );
    setManualValidation(res);
  };

  const displayResult = manualValidation || activeResponse?.schemaValidation;

  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="flex items-center gap-2 font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) =>
              updateActiveRequest({
                schemaValidation: { ...cfg, enabled: e.target.checked },
              })
            }
            className="rounded border-slate-700 text-cyan-500 bg-slate-950"
          />
          <FileJson className="w-4 h-4 text-cyan-400" />
          <span>Validate Response against JSON Schema</span>
        </label>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => handleFileUpload(e, 'request')}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-cyan-300 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import .json</span>
          </button>

          {activeResponse && effectiveSchemaText.trim() && (
            <button
              type="button"
              onClick={handleValidateNow}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Validate Current Response</span>
            </button>
          )}
        </div>
      </div>

      {/* Select saved schema or inline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-slate-400 uppercase mb-1">Schema Source</label>
          <select
            value={cfg.schemaId || '__inline__'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__inline__') {
                updateActiveRequest({
                  schemaValidation: { ...cfg, schemaId: undefined },
                });
              } else {
                updateActiveRequest({
                  schemaValidation: { ...cfg, enabled: true, schemaId: val },
                });
              }
            }}
            className="w-full px-2.5 py-1.5 rounded bg-slate-900/70 dark:bg-slate-900/70 light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 text-xs"
          >
            <option value="__inline__">Custom Inline Schema</option>
            {schemas.map((s) => (
              <option key={s.id} value={s.id}>
                Saved: {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        rows={10}
        readOnly={Boolean(activeSavedSchema)}
        value={effectiveSchemaText}
        onChange={(e) =>
          updateActiveRequest({
            schemaValidation: {
              ...cfg,
              enabled: true,
              schemaId: undefined,
              inlineSchema: e.target.value,
            },
          })
        }
        placeholder={'{\n  "type": "object",\n  "required": ["id", "name"],\n  "properties": {\n    "id": { "type": "number" },\n    "name": { "type": "string" }\n  }\n}'}
        className="w-full p-3 rounded bg-[#0c1018] border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
      />

      {/* Validation result summary */}
      {displayResult && (
        <div
          className={`p-3 rounded-lg border space-y-2 ${
            displayResult.valid
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/25 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              {displayResult.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span>
                {displayResult.valid
                  ? 'Response matches JSON Schema'
                  : `Schema Validation Failed (${displayResult.errorCount} error${displayResult.errorCount === 1 ? '' : 's'})`}
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              {displayResult.durationMs}ms
            </span>
          </div>

          {!displayResult.valid && displayResult.errors.length > 0 && (
            <div className="space-y-1 font-mono text-[11px]">
              {displayResult.errors.map((err, i) => (
                <div key={i} className="p-2 rounded bg-black/30 border border-red-500/20">
                  <span className="text-red-300 font-semibold">{err.path}</span>{' '}
                  <span className="text-slate-300">[{err.keyword}]</span>: {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
