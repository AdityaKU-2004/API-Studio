import React, { useState } from 'react';
import { Search, Plus, FolderPlus, Layers } from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useAppStore } from '../../stores/appStore';
import { CollectionItemRow } from './CollectionItemRow';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { CollectionItem } from '../../types';

export const CollectionTree: React.FC = () => {
  const { collections } = useCollectionStore();
  const { setNewCollectionModalOpen } = useAppStore();

  const [filterText, setFilterText] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleOpenDelete = (title: string, message: string, onConfirm: () => void) => {
    setDeleteDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  // Filter collections and their children
  const filterItem = (item: CollectionItem, query: string): CollectionItem | null => {
    const matchesName = item.name.toLowerCase().includes(query);
    const matchesUrl = item.request?.url.toLowerCase().includes(query);

    if (item.children) {
      const filteredChildren = item.children
        .map((child) => filterItem(child, query))
        .filter(Boolean) as CollectionItem[];

      if (filteredChildren.length > 0 || matchesName || matchesUrl) {
        return {
          ...item,
          isExpanded: true,
          children: filteredChildren,
        };
      }
    }

    if (matchesName || matchesUrl) {
      return item;
    }

    return null;
  };

  const filteredCollections = filterText.trim()
    ? (collections
        .map((col) => filterItem(col, filterText.toLowerCase().trim()))
        .filter(Boolean) as CollectionItem[])
    : collections;

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header with Search and Create button */}
      <div className="p-2 space-y-2 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 light:text-slate-600 uppercase tracking-wider">
            Collections ({collections.length})
          </span>
          <button
            type="button"
            onClick={() => setNewCollectionModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </button>
        </div>

        {/* Filter input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter collections & requests..."
            className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100/90 text-slate-200 dark:text-slate-200 light:text-slate-800 placeholder:text-slate-500 border border-slate-800 dark:border-slate-800 light:border-slate-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {filteredCollections.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            {filterText ? (
              <p>No matching requests found</p>
            ) : (
              <div className="space-y-2">
                <FolderPlus className="w-8 h-8 mx-auto text-slate-600 stroke-1" />
                <p>No collections yet</p>
                <button
                  type="button"
                  onClick={() => setNewCollectionModalOpen(true)}
                  className="px-3 py-1 text-xs text-cyan-400 hover:underline"
                >
                  Create your first collection
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredCollections.map((col) => (
            <CollectionItemRow
              key={col.id}
              item={col}
              level={0}
              onConfirmDelete={handleOpenDelete}
            />
          ))
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteDialog.onConfirm}
        title={deleteDialog.title}
        message={deleteDialog.message}
      />
    </div>
  );
};
