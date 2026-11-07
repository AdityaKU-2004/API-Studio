import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { Modal } from '../common/Modal';

export const NewCollectionModal: React.FC = () => {
  const { isNewCollectionModalOpen, setNewCollectionModalOpen } = useAppStore();
  const { addCollection } = useCollectionStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addCollection(name, description);
    setName('');
    setDescription('');
    setNewCollectionModalOpen(false);
  };

  return (
    <Modal
      isOpen={isNewCollectionModalOpen}
      onClose={() => setNewCollectionModalOpen(false)}
      title="Create New Collection"
      description="Organize related API requests, test suites, and documentation"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-300 font-medium mb-1.5">Collection Name</label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Payment Gateway, Customer Auth, V2 Ingestion"
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200"
          />
        </div>

        <div>
          <label className="block text-slate-300 font-medium mb-1.5">Description (Optional)</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the scope or microservice purpose..."
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 focus:outline-none focus:border-cyan-400 text-slate-200 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setNewCollectionModalOpen(false)}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:brightness-110 active:brightness-95 transition-all cursor-pointer shadow-md"
          >
            Create Collection
          </button>
        </div>
      </form>
    </Modal>
  );
};
