import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Shield,
  FileCode,
  DollarSign,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Check,
  Folder,
  Layers,
  Palette,
} from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { collectionRepository } from '../../repositories/collectionRepository';
import { folderRepository } from '../../repositories/folderRepository';
import { CollectionDefinition, FolderDefinition, KeyValueItem, EnvironmentVariable, AuthConfig } from '../../types';

const COLOR_OPTIONS = [
  { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500', border: 'border-cyan-400' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-500', border: 'border-blue-400' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500', border: 'border-emerald-400' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500', border: 'border-amber-400' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500', border: 'border-rose-400' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-500', border: 'border-purple-400' },
];

export const CollectionSettingsModal: React.FC = () => {
  const { activeCollectionSettingsId, setActiveCollectionSettingsId, loadCollections } = useCollectionStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'auth' | 'headers' | 'variables'>('overview');
  const [collection, setCollection] = useState<CollectionDefinition | null>(null);
  const [folder, setFolder] = useState<FolderDefinition | null>(null);
  const [isFolder, setIsFolder] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  // Local editable state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('cyan');
  const [auth, setAuth] = useState<AuthConfig>({ type: 'inherit' });
  const [headers, setHeaders] = useState<KeyValueItem[]>([]);
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);

  useEffect(() => {
    if (!activeCollectionSettingsId) {
      setCollection(null);
      setFolder(null);
      return;
    }

    const loadItem = async () => {
      // Check if it is a collection or folder
      const col = await collectionRepository.getById(activeCollectionSettingsId);
      if (col) {
        setIsFolder(false);
        setCollection(col);
        setName(col.name);
        setDescription(col.description || '');
        setColor(col.color || 'cyan');
        setAuth(col.auth || { type: 'none' });
        setHeaders(col.headers || []);
        setVariables(col.variables || []);
        return;
      }

      const fld = await folderRepository.getById(activeCollectionSettingsId);
      if (fld) {
        setIsFolder(true);
        setFolder(fld);
        setName(fld.name);
        setDescription(fld.description || '');
        setAuth(fld.auth || { type: 'inherit' });
        setHeaders(fld.headers || []);
        setVariables(fld.variables || []);
      }
    };

    loadItem();
  }, [activeCollectionSettingsId]);

  if (!activeCollectionSettingsId || (!collection && !folder)) return null;

  const handleSave = async () => {
    if (isFolder && folder) {
      await folderRepository.update(folder.id, {
        name: name.trim() || folder.name,
        description,
        auth,
        headers,
        variables,
      });
    } else if (collection) {
      await collectionRepository.update(collection.id, {
        name: name.trim() || collection.name,
        description,
        color,
        auth,
        headers,
        variables,
      });
    }

    await loadCollections();
    setActiveCollectionSettingsId(null);
  };

  const handleAddHeader = () => {
    setHeaders([
      ...headers,
      { id: 'h-' + Date.now(), key: '', value: '', description: '', enabled: true },
    ]);
  };

  const handleUpdateHeader = (index: number, updates: Partial<KeyValueItem>) => {
    const updated = [...headers];
    updated[index] = { ...updated[index], ...updates };
    setHeaders(updated);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleAddVariable = () => {
    setVariables([
      ...variables,
      {
        id: 'var-' + Date.now(),
        key: '',
        initialValue: '',
        currentValue: '',
        isSecret: false,
        enabled: true,
        scope: isFolder ? 'folder' : 'collection',
      },
    ]);
  };

  const handleUpdateVariable = (index: number, updates: Partial<EnvironmentVariable>) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], ...updates };
    setVariables(updated);
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl bg-[#121620] border border-blue-500/25 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              {isFolder ? <Folder className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {isFolder ? `Folder Settings: ${folder?.name}` : `Collection Settings: ${collection?.name}`}
              </h2>
              <p className="text-[11px] text-slate-400">
                Manage metadata, default authorization inheritance, shared headers, and scoped variables.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveCollectionSettingsId(null)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 border-b border-slate-800/80 bg-slate-950/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'auth'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Authorization</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'headers'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Shared Headers ({headers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('variables')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'variables'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Variables ({variables.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes or documentation for this collection..."
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {!isFolder && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">Accent Color</label>
                  <div className="flex items-center gap-3">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.id)}
                        className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center transition-transform ${
                          color === c.id ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {color === c.id && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'auth' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/20 text-xs text-slate-300">
                Requests within this {isFolder ? 'folder' : 'collection'} configured with &quot;Inherit auth from parent&quot; will automatically use these credentials during execution.
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Type</label>
                <select
                  value={auth.type}
                  onChange={(e) => setAuth({ ...auth, type: e.target.value as any })}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  {isFolder && <option value="inherit">Inherit auth from parent collection</option>}
                  <option value="none">No Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="apiKey">API Key</option>
                </select>
              </div>

              {auth.type === 'bearer' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Token (supports {`{{variable}}`})</label>
                  <input
                    type="password"
                    value={auth.bearer?.token || ''}
                    onChange={(e) =>
                      setAuth({
                        ...auth,
                        bearer: { token: e.target.value, prefix: auth.bearer?.prefix || 'Bearer' },
                      })
                    }
                    placeholder="e.g. {{auth_token}} or eyJhbGciOi..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              )}

              {auth.type === 'basic' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
                    <input
                      type="text"
                      value={auth.basic?.username || ''}
                      onChange={(e) =>
                        setAuth({
                          ...auth,
                          basic: { username: e.target.value, password: auth.basic?.password || '' },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                    <input
                      type="password"
                      value={auth.basic?.password || ''}
                      onChange={(e) =>
                        setAuth({
                          ...auth,
                          basic: { username: auth.basic?.username || '', password: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}

              {auth.type === 'apiKey' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Key</label>
                    <input
                      type="text"
                      value={auth.apiKey?.key || ''}
                      onChange={(e) =>
                        setAuth({
                          ...auth,
                          apiKey: { key: e.target.value, value: auth.apiKey?.value || '', addTo: auth.apiKey?.addTo || 'header' },
                        })
                      }
                      placeholder="X-API-Key"
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Value</label>
                    <input
                      type="password"
                      value={auth.apiKey?.value || ''}
                      onChange={(e) =>
                        setAuth({
                          ...auth,
                          apiKey: { key: auth.apiKey?.key || '', value: e.target.value, addTo: auth.apiKey?.addTo || 'header' },
                        })
                      }
                      placeholder="{{api_key}}"
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Add To</label>
                    <select
                      value={auth.apiKey?.addTo || 'header'}
                      onChange={(e) =>
                        setAuth({
                          ...auth,
                          apiKey: { key: auth.apiKey?.key || '', value: auth.apiKey?.value || '', addTo: e.target.value as any },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="header">Header</option>
                      <option value="query">Query Params</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'headers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Headers defined here are sent with every request in this {isFolder ? 'folder' : 'collection'} unless overridden by the request.
                </p>
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Header</span>
                </button>
              </div>

              {headers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800">
                  No shared headers configured.
                </div>
              ) : (
                <div className="space-y-2">
                  {headers.map((h, idx) => (
                    <div key={h.id || idx} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => handleUpdateHeader(idx, { enabled: e.target.checked })}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <input
                        type="text"
                        value={h.key}
                        onChange={(e) => handleUpdateHeader(idx, { key: e.target.value })}
                        placeholder="Header Name"
                        className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                      />
                      <input
                        type="text"
                        value={h.value}
                        onChange={(e) => handleUpdateHeader(idx, { value: e.target.value })}
                        placeholder="Header Value"
                        className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(idx)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'variables' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Variables scoped to this {isFolder ? 'folder' : 'collection'}. They override global and environment variables of the same name.
                </p>
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variable</span>
                </button>
              </div>

              {variables.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800">
                  No scoped variables configured.
                </div>
              ) : (
                <div className="space-y-2">
                  {variables.map((v, idx) => {
                    const isRevealed = !!revealedSecrets[v.id];
                    return (
                      <div key={v.id || idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={v.enabled}
                          onChange={(e) => handleUpdateVariable(idx, { enabled: e.target.checked })}
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                        />
                        <input
                          type="text"
                          value={v.key}
                          onChange={(e) => handleUpdateVariable(idx, { key: e.target.value })}
                          placeholder="variable_name"
                          className="w-1/3 px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                        />
                        <div className="relative flex-1">
                          <input
                            type={v.isSecret && !isRevealed ? 'password' : 'text'}
                            value={v.currentValue ?? v.initialValue ?? ''}
                            onChange={(e) =>
                              handleUpdateVariable(idx, {
                                currentValue: e.target.value,
                                initialValue: v.initialValue || e.target.value,
                              })
                            }
                            placeholder="Value"
                            className="w-full pl-2.5 pr-8 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                          />
                          {v.isSecret && (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedSecrets((prev) => ({ ...prev, [v.id]: !prev[v.id] }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                            >
                              {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateVariable(idx, { isSecret: !v.isSecret })}
                          title={v.isSecret ? 'Mark as normal variable' : 'Mark as secret (masked)'}
                          className={`px-2 py-1 text-[10px] rounded border font-mono transition-colors ${
                            v.isSecret
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'text-slate-500 border-slate-800 hover:text-slate-300'
                          }`}
                        >
                          {v.isSecret ? 'SECRET' : 'PLAIN'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariable(idx)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800/80 bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveCollectionSettingsId(null)}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
