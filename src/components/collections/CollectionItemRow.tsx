import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  MoreVertical,
  Plus,
  Copy,
  Trash2,
  Edit2,
  FileText,
} from 'lucide-react';
import { CollectionItem } from '../../types';
import { MethodBadge } from '../common/MethodBadge';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useAppStore } from '../../stores/appStore';

interface CollectionItemRowProps {
  item: CollectionItem;
  level?: number;
  onConfirmDelete: (title: string, message: string, onConfirm: () => void) => void;
}

export const CollectionItemRow: React.FC<CollectionItemRowProps> = ({
  item,
  level = 0,
  onConfirmDelete,
}) => {
  const { expandedIds, toggleExpanded, renameCollection, renameFolder, duplicateRequest, deleteCollection, deleteFolder, deleteRequest } = useCollectionStore();
  const { openRequestInTab, tabs, activeTabId } = useRequestStore();
  const { setNewFolderModalOpen, setNewRequestModalOpen } = useAppStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExpanded = !!expandedIds[item.id];
  const hasChildren = item.children && item.children.length > 0;

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isActiveRequest = item.type === 'request' && activeTab?.requestId === item.requestId;

  // Focus on rename
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // Click outside to close menu
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isMenuOpen]);

  const handleRowClick = () => {
    if (item.type === 'collection' || item.type === 'folder') {
      toggleExpanded(item.id);
    } else if (item.type === 'request' && item.request) {
      openRequestInTab(item.request);
    }
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim()) {
      if (item.type === 'collection') {
        renameCollection(item.id, editName);
      } else if (item.type === 'folder') {
        renameFolder(item.id, editName);
      }
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    if (item.type === 'collection') {
      onConfirmDelete(
        'Delete Collection',
        `Are you sure you want to delete "${item.name}" and all of its requests? This action cannot be undone.`,
        () => deleteCollection(item.id)
      );
    } else if (item.type === 'folder') {
      onConfirmDelete(
        'Delete Folder',
        `Are you sure you want to delete folder "${item.name}"?`,
        () => deleteFolder(item.id)
      );
    } else if (item.type === 'request' && item.requestId) {
      onConfirmDelete(
        'Delete Request',
        `Are you sure you want to delete request "${item.name}"?`,
        () => deleteRequest(item.requestId!)
      );
    }
  };

  return (
    <div className="select-none">
      <div
        style={{ paddingLeft: `${Math.max(8, level * 16 + 8)}px` }}
        onClick={handleRowClick}
        className={`group relative flex items-center justify-between pr-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
          isActiveRequest
            ? 'bg-blue-600/20 text-cyan-300 font-medium border border-blue-500/30'
            : 'text-slate-300 dark:text-slate-300 light:text-slate-700 hover:bg-slate-800/40 dark:hover:bg-slate-800/40 light:hover:bg-blue-50/60'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {item.type === 'collection' || item.type === 'folder' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.id);
              }}
              className="p-0.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div className="w-3.5" />
          )}

          {item.type === 'collection' ? (
            isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
            )
          ) : item.type === 'folder' ? (
            <Folder className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
          ) : item.request?.method ? (
            <MethodBadge method={item.request.method} size="sm" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}

          {isEditing ? (
            <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()} className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => setIsEditing(false)}
                className="w-full px-1.5 py-0.5 bg-slate-900 border border-cyan-400 rounded text-xs text-white focus:outline-none"
              />
            </form>
          ) : (
            <span className="truncate" title={item.name}>
              {item.name}
            </span>
          )}
        </div>

        {/* Action Menu button */}
        <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-opacity cursor-pointer"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg glass-panel-dark dark:glass-panel-dark light:glass-panel-light bg-[#12161f]/95 dark:bg-[#12161f]/95 light:bg-white/95 text-slate-200 dark:text-slate-200 light:text-slate-800 border border-blue-500/25 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              {item.type === 'collection' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setNewRequestModalOpen(true, item.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 text-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Add Request</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setNewFolderModalOpen(true, item.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 text-slate-200 cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>Add Folder</span>
                  </button>
                </>
              )}

              {item.type === 'folder' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setNewRequestModalOpen(true, item.parentId || undefined, item.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 text-slate-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Add Request</span>
                </button>
              )}

              {item.type === 'request' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (item.requestId) duplicateRequest(item.requestId);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 text-slate-200 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-400" />
                  <span>Duplicate</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsEditing(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-blue-600/20 text-slate-200 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Rename</span>
              </button>

              <div className="border-t border-slate-700/60 dark:border-slate-800/80 light:border-slate-200 my-1" />

              <button
                type="button"
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-red-500/20 text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Render children if expanded */}
      {isExpanded && hasChildren && (
        <div className="space-y-0.5">
          {item.children!.map((child) => (
            <CollectionItemRow
              key={child.id}
              item={child}
              level={level + 1}
              onConfirmDelete={onConfirmDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
