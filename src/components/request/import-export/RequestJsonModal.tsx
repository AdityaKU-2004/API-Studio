import React, { useState, useMemo, useRef } from 'react';
import { Modal } from '../../common/Modal';
import { ApiRequest } from '../../../types';
import { serializeRequestToJson, deserializeRequestFromJson } from '../../../services/request/requestSerializer';
import { useRequestStore } from '../../../stores/requestStore';
import { Copy, Check, Download, Upload, FileCode, AlertCircle } from 'lucide-react';

interface RequestJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRequest: ApiRequest;
}

export const RequestJsonModal: React.FC<RequestJsonModalProps> = ({
  isOpen,
  onClose,
  activeRequest,
}) => {
  const { addTab } = useRequestStore();
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [importJsonText, setImportJsonText] = useState('');
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportedJson = useMemo(() => {
    return serializeRequestToJson(activeRequest, true);
  }, [activeRequest]);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeRequest.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.api-studio.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setImportJsonText(content);
      };
      reader.readAsText(file);
    }
  };

  const handleDoImport = () => {
    setImportError(null);
    const result = deserializeRequestFromJson(importJsonText);
    if (!result.success || !result.request) {
      setImportError(result.error || 'Failed to parse JSON request definition');
      return;
    }

    addTab(result.request);
    setImportJsonText('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request JSON Import / Export"
      description="Serialize and restore full API request definitions as standard JSON"
      maxWidth="3xl"
    >
      <div className="space-y-4 text-xs">
        {/* Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/60 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('export')}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              mode === 'export'
                ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Export JSON Definition
          </button>
          <button
            type="button"
            onClick={() => setMode('import')}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              mode === 'import'
                ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Import JSON Definition
          </button>
        </div>

        {mode === 'export' && (
          <div className="space-y-3">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-slate-950 font-mono text-xs text-cyan-300 border border-slate-800 max-h-80 overflow-auto">
                {exportedJson}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:brightness-110 active:brightness-95 transition-all cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .json File</span>
              </button>
            </div>
          </div>
        )}

        {mode === 'import' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-medium">Paste Request JSON</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload .json File</span>
                </button>
              </div>

              <textarea
                rows={9}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='{\n  "name": "My Endpoint",\n  "method": "GET",\n  "url": "https://api.example.com",\n  "headers": [...]\n}'
                className="w-full p-3 rounded-lg bg-slate-950 font-mono text-xs text-cyan-300 border border-slate-800 focus:outline-none focus:border-cyan-400 resize-none"
              />
            </div>

            {importError && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center gap-2 text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{importError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDoImport}
                disabled={!importJsonText.trim()}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:brightness-110 active:brightness-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                Import into Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
