import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { Modal } from '../common/Modal';

export const NewFolderModal: React.FC = () => {
  const { isNewFolderModalOpen, setNewFolderModalOpen, targetCollectionIdForNewItem } = useAppStore();
  const { addFolder } = useCollectionStore();

  const [folderName, setFolderName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || !targetCollectionIdForNewItem) return;
    addFolder(targetCollectionIdForNewItem, folderName);
    setFolderName('');
    setNewFolderModalOpen(false);
  };

  return (
    <Modal
      isOpen={isNewFolderModalOpen}
      onClose={() => setNewFolderModalOpen(false)}
      title="Create New Folder"
      description="Add a subfolder to group related endpoints inside this collection"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-300 font-medium mb-1.5">Folder Name</label>
          <input
            type="text"
            required
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="e.g., Accounts, Profile, Subscriptions"
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setNewFolderModalOpen(false)}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:brightness-110 active:brightness-95 transition-all cursor-pointer shadow-md"
          >
            Create Folder
          </button>
        </div>
      </form>
    </Modal>
  );
};
