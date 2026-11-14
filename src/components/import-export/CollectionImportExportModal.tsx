import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  FileJson,
  AlertCircle,
  Folder,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { collectionExporter } from '../../services/collections/collectionExporter';
import { collectionImporter, ParsedImportResult } from '../../services/collections/collectionImporter';

export const CollectionImportExportModal: React.FC = () => {
  const {
    isImportExportModalOpen,
    importExportMode,
    targetCollectionIdForExport,
    setImportExportModalOpen,
  } = useAppStore();

  const { collections, loadCollections } = useCollectionStore();

  const [activeTab, setActiveTab] = useState<'import' | 'export'>('export');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'apiStudio' | 'postman'>('apiStudio');
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [exportedJson, setExportedJson] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Import state
  const [importInput, setImportInput] = useState('');
  const [parsedImport, setParsedImport] = useState<ParsedImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isImportExportModalOpen) {
      setActiveTab(importExportMode);
      const defaultId = targetCollectionIdForExport || (collections.length > 0 ? collections[0].id : '');
      setSelectedCollectionId(defaultId);
      setImportSuccessMessage(null);
      setParsedImport(null);
    }
  }, [isImportExportModalOpen, importExportMode, targetCollectionIdForExport, collections]);

  // Update export preview
  useEffect(() => {
    if (!selectedCollectionId) {
      setExportedJson('');
      return;
    }

    const generateExport = async () => {
      try {
        if (exportFormat === 'postman') {
          const postmanData = await collectionExporter.exportPostmanV21(selectedCollectionId, { includeSecrets });
          setExportedJson(JSON.stringify(postmanData, null, 2));
        } else {
          const apiStudioData = await collectionExporter.exportApiStudio(selectedCollectionId, { includeSecrets });
          setExportedJson(JSON.stringify(apiStudioData, null, 2));
        }
      } catch (err) {
        console.error('Export error:', err);
        setExportedJson('// Error generating export preview');
      }
    };

    generateExport();
  }, [selectedCollectionId, exportFormat, includeSecrets]);

  // Parse import input when user pastes or uploads
  useEffect(() => {
    if (!importInput.trim()) {
      setParsedImport(null);
      return;
    }

    try {
      const result = collectionImporter.parseInput(importInput);
      setParsedImport(result);
    } catch {
      setParsedImport({
        format: 'unknown',
        collection: { name: 'Invalid JSON' } as any,
        folders: [],
        requests: [],
        errors: ['Failed to parse JSON content'],
      });
    }
  }, [importInput]);

  if (!isImportExportModalOpen) return null;

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportedJson);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const col = collections.find((c) => c.id === selectedCollectionId);
    const filename = `${(col?.name || 'collection').toLowerCase().replace(/\s+/g, '_')}_${exportFormat}.json`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportInput(text);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!parsedImport || parsedImport.errors.length > 0) return;

    setIsImporting(true);
    try {
      const result = await collectionImporter.commitImport(parsedImport);
      await loadCollections();
      setImportSuccessMessage(
        `Successfully imported "${result.collectionName}" (${result.requestCount} requests in ${result.folderCount} folders)!`
      );
      setImportInput('');
      setParsedImport(null);
    } catch (err: any) {
      alert('Import failed: ' + (err.message || String(err)));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl bg-[#121620] border border-blue-500/25 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Collection Import & Export</h2>
              <p className="text-[11px] text-slate-400">
                Interoperate with Postman Collection v2.1 and native API Studio packages.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImportExportModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-5 border-b border-slate-800/80 bg-slate-950/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'export'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Collection</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'import'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Collection</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Collection</label>
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Format</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="apiStudio">API Studio JSON Format</option>
                    <option value="postman">Postman Collection v2.1</option>
                  </select>
                </div>
              </div>

              {/* Secrets checkbox */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                <input
                  type="checkbox"
                  id="includeSecrets"
                  checked={includeSecrets}
                  onChange={(e) => setIncludeSecrets(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="includeSecrets" className="text-slate-300 cursor-pointer flex-1">
                  Include secret and sensitive variable values in exported file
                </label>
                {includeSecrets && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Secrets Included
                  </span>
                )}
              </div>

              {/* JSON preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">Generated Payload Preview</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyExport}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExport}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .json</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  rows={10}
                  value={exportedJson}
                  className="w-full px-3 py-2 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {importSuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {/* Upload file or paste */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Paste JSON or Upload File
                  </label>
                  <label className="text-[11px] text-cyan-400 hover:underline cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    <span>Browse .json file</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={8}
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="Paste Postman v2.1 or API Studio JSON export here..."
                  className="w-full px-3 py-2 text-[11px] font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Parse summary */}
              {parsedImport && (
                <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      {parsedImport.collection.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-600/20 text-cyan-300 border border-blue-500/30">
                      Format: {parsedImport.format === 'postman' ? 'Postman v2.1' : 'API Studio Native'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500">Folders</div>
                      <div className="text-xs font-semibold text-slate-200">{parsedImport.folders.length}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500">Requests</div>
                      <div className="text-xs font-semibold text-slate-200">{parsedImport.requests.length}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500">Variables</div>
                      <div className="text-xs font-semibold text-slate-200">
                        {parsedImport.collection.variables?.length || 0}
                      </div>
                    </div>
                  </div>

                  {parsedImport.errors.length > 0 && (
                    <div className="p-2.5 rounded bg-red-950/30 border border-red-500/30 text-red-300 text-[11px] space-y-1">
                      {parsedImport.errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/80 bg-slate-900/50">
          <span className="text-[11px] text-slate-500 font-mono">
            {activeTab === 'export' ? `${exportFormat === 'postman' ? 'Postman v2.1' : 'API Studio'} standard` : 'Auto-detecting format'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportExportModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Close
            </button>
            {activeTab === 'export' ? (
              <button
                type="button"
                onClick={handleDownloadExport}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!parsedImport || parsedImport.errors.length > 0 || isImporting}
                onClick={handleExecuteImport}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isImporting ? 'Importing...' : 'Confirm & Import Collection'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
