import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';

interface SaveRequestAsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaveRequestAsModal: React.FC<SaveRequestAsModalProps> = ({ isOpen, onClose }) => {
  const { collections } = useCollectionStore();
  const { tabs, activeTabId, saveRequestAs } = useRequestStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const [name, setName] = useState(request?.name || 'New Request');
  const [selectedCol, setSelectedCol] = useState(request?.collectionId || collections[0]?.id || '');
  const [selectedFolder, setSelectedFolder] = useState(request?.folderId || '');

  useEffect(() => {
    if (request) {
      setName(request.name);
      setSelectedCol(request.collectionId || collections[0]?.id || '');
      setSelectedFolder(request.folderId || '');
    }
  }, [request, collections]);

  const targetCol = collections.find((c) => c.id === selectedCol);
  const folders = targetCol?.children?.filter((c) => c.type === 'folder') || [];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    saveRequestAs(name.trim(), selectedCol, selectedFolder || undefined);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save Request As"
      description="Save current request configuration to a collection and folder"
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-300 font-medium mb-1.5">Request Name</label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
          />
        </div>

        <div>
          <label className="block text-slate-300 font-medium mb-1.5">Collection</label>
          <select
            value={selectedCol}
            onChange={(e) => {
              setSelectedCol(e.target.value);
              setSelectedFolder('');
            }}
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 cursor-pointer"
          >
            {collections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        </div>

        {folders.length > 0 && (
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Folder (Optional)</label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 cursor-pointer"
            >
              <option value="">Root of collection</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:brightness-110 active:brightness-95 transition-all cursor-pointer shadow-md"
          >
            Save Request
          </button>
        </div>
      </form>
    </Modal>
  );
};
