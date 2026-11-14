import React, { useState, useMemo } from 'react';
import { Search, Plus, FolderPlus, ArrowUpDown, Upload, Download, Database } from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useAppStore } from '../../stores/appStore';
import { CollectionItemRow } from './CollectionItemRow';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { CollectionItem } from '../../types';

export const CollectionTree: React.FC = () => {
  const { collections, moveRequest, draggedItem, setDraggedItem } = useCollectionStore();
  const { setNewCollectionModalOpen, setImportExportModalOpen, setBackupRestoreModalOpen } = useAppStore();

  const [filterText, setFilterText] = useState('');
  const [sortOrder, setSortOrder] = useState<'custom' | 'az' | 'za'>('custom');
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

  const processedCollections = useMemo(() => {
    let result = collections;

    if (filterText.trim()) {
      result = result
        .map((col) => filterItem(col, filterText.toLowerCase().trim()))
        .filter(Boolean) as CollectionItem[];
    }

    if (sortOrder === 'az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'za') {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [collections, filterText, sortOrder]);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header with Search and Create button */}
      <div className="p-2 space-y-2 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 light:text-slate-600 uppercase tracking-wider">
            Collections ({collections.length})
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setImportExportModalOpen(true, 'import')}
              title="Import Collection"
              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setBackupRestoreModalOpen(true)}
              title="Backup / Restore Workstation"
              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setNewCollectionModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Filter input & Sort toggle */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter requests..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100/90 text-slate-200 dark:text-slate-200 light:text-slate-800 placeholder:text-slate-500 border border-slate-800 dark:border-slate-800 light:border-slate-200 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (sortOrder === 'custom') setSortOrder('az');
              else if (sortOrder === 'az') setSortOrder('za');
              else setSortOrder('custom');
            }}
            title={`Sort: ${sortOrder === 'custom' ? 'Custom' : sortOrder === 'az' ? 'A to Z' : 'Z to A'}`}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              sortOrder !== 'custom'
                ? 'bg-blue-600/20 text-cyan-300 border-blue-500/30'
                : 'text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {processedCollections.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            {filterText ? (
              <p>No matching requests found</p>
            ) : (
              <div className="space-y-2">
                <FolderPlus className="w-8 h-8 mx-auto text-slate-600 stroke-1" />
                <p>No collections yet</p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setNewCollectionModalOpen(true)}
                    className="px-2.5 py-1 text-xs text-cyan-400 hover:underline"
                  >
                    Create Collection
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={() => setImportExportModalOpen(true, 'import')}
                    className="px-2.5 py-1 text-xs text-cyan-400 hover:underline"
                  >
                    Import Postman
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          processedCollections.map((col) => (
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
