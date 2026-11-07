import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { Modal } from './Modal';
import { Terminal, Send, Command, Layers, Sparkles, BookOpen } from 'lucide-react';

export const DocsModal: React.FC = () => {
  const { isDocsOpen, setDocsOpen } = useAppStore();

  const shortcuts = [
    { key: 'Ctrl + Enter', desc: 'Send current active request' },
    { key: 'Ctrl + K / ⌘K', desc: 'Open global search command palette' },
    { key: 'Ctrl + S', desc: 'Save request changes to collection' },
    { key: 'Ctrl + T', desc: 'Open a new request tab' },
    { key: 'Ctrl + W', desc: 'Close active request tab' },
  ];

  return (
    <Modal
      isOpen={isDocsOpen}
      onClose={() => setDocsOpen(false)}
      title="API Studio Documentation & Shortcuts"
      description="Keyboard shortcuts and workflow guide for API development"
      maxWidth="xl"
    >
      <div className="space-y-6 text-xs text-slate-300">
        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-2">
            <Command className="w-4 h-4 text-cyan-400" />
            Keyboard Shortcuts
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shortcuts.map((sc) => (
              <div
                key={sc.key}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800"
              >
                <span className="text-slate-400">{sc.desc}</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] border border-slate-700">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Environment Variables
          </h4>
          <p className="text-slate-400 leading-relaxed">
            Reference variables anywhere in URLs, Headers, Authorization tokens, or Request bodies using double curly braces:
          </p>
          <div className="mt-2 p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-cyan-300 border border-slate-800">
            https://{'{{base_url}}'}/users/{'{{user_id}}'}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Phase 1 & Architecture Overview
          </h4>
          <p className="text-slate-400 leading-relaxed">
            API Studio is architected with a decoupled frontend interface layer (Zustand stores, Monaco Editor, reactive tab management, and mock simulation engine) ready for direct binding to Tauri 2 and high-performance native Rust HTTP/QUIC workers in subsequent phases.
          </p>
        </div>
      </div>
    </Modal>
  );
};
