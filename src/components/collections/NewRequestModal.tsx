import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore, createDefaultRequest } from '../../stores/requestStore';
import { Modal } from '../common/Modal';
import { HttpMethod } from '../../types';

export const NewRequestModal: React.FC = () => {
  const {
    isNewRequestModalOpen,
    setNewRequestModalOpen,
    targetCollectionIdForNewItem,
    targetFolderIdForNewItem,
  } = useAppStore();

  const { addRequestToCollection, collections } = useCollectionStore();
  const { openRequestInTab } = useRequestStore();

  const [name, setName] = useState('');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('{{base_url}}/');
  const [selectedCol, setSelectedCol] = useState(targetCollectionIdForNewItem || collections[0]?.id || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newReq = createDefaultRequest(name.trim(), method);
    newReq.url = url.trim() || '{{base_url}}/';

    const colId = selectedCol || targetCollectionIdForNewItem || collections[0]?.id || 'col-users';
    addRequestToCollection(colId, targetFolderIdForNewItem, newReq);
    openRequestInTab(newReq);

    setName('');
    setMethod('GET');
    setUrl('{{base_url}}/');
    setNewRequestModalOpen(false);
  };

  return (
    <Modal
      isOpen={isNewRequestModalOpen}
      onClose={() => setNewRequestModalOpen(false)}
      title="Create New Request"
      description="Add an API endpoint to your collection"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-300 font-medium mb-1.5">Request Name</label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Get Organization Details, Search Inventory"
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="w-full px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 font-mono font-semibold"
            >
              {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-slate-300 font-medium mb-1.5">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="{{base_url}}/endpoint"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-300 font-medium mb-1.5">Collection Destination</label>
          <select
            value={selectedCol}
            onChange={(e) => setSelectedCol(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
          >
            {collections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setNewRequestModalOpen(false)}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:brightness-110 active:brightness-95 transition-all cursor-pointer shadow-md"
          >
            Add Request
          </button>
        </div>
      </form>
    </Modal>
  );
};
