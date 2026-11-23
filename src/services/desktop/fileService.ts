import { open, save } from '@tauri-apps/plugin-dialog';
import { NativeReadFileResult } from '../../types';
import { IFileOperationsService } from '../protocols/contracts';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from './tauriBridge';

export class DesktopFileService implements IFileOperationsService {
  public async readTextFile(accept?: string): Promise<{ name: string; content: string } | null> {
    const extensions = accept
      ? accept
          .split(',')
          .map((s) => s.trim().replace(/^\./, ''))
          .filter(Boolean)
      : ['json', 'csv', 'txt', 'xml'];

    if (!isTauriRuntime()) {
      return null;
    }

    const selected = await open({
      multiple: false,
      filters: [{ name: 'Supported Files', extensions }],
    });
    if (!selected || Array.isArray(selected)) return null;

    const result = await invokeDesktop<NativeReadFileResult>('read_native_file', {
      path: selected,
      allowedExtensions: extensions,
    });
    return {
      name: result.fileName,
      content: result.contentUtf8 ?? '',
    };
  }

  public async saveTextFile(filename: string, content: string): Promise<void> {
    if (!isTauriRuntime()) return;
    const ext = filename.includes('.') ? filename.split('.').pop() || 'txt' : 'txt';
    const targetPath = await save({
      defaultPath: filename,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!targetPath) return;

    await invokeDesktop<number>('save_native_file', {
      payload: {
        path: targetPath,
        contentUtf8: content,
        contentBase64: null,
      },
    });
  }

  public async saveBinaryBase64File(filename: string, contentBase64: string): Promise<boolean> {
    if (!isTauriRuntime()) return false;
    const ext = filename.includes('.') ? filename.split('.').pop() || 'bin' : 'bin';
    const targetPath = await save({
      defaultPath: filename,
      filters: [{ name: ext.toUpperCase(), extensions: [ext, 'bin'] }],
    });
    if (!targetPath) return false;

    await invokeDesktop<number>('save_native_file', {
      payload: {
        path: targetPath,
        contentUtf8: null,
        contentBase64,
      },
    });
    return true;
  }
}

export class BrowserFileService implements IFileOperationsService {
  public async readTextFile(accept = '.json,.csv,.txt,.xml'): Promise<{ name: string; content: string } | null> {
    if (typeof document === 'undefined') return null;
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, content: String(reader.result || '') });
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      input.click();
    });
  }

  public async saveTextFile(
    filename: string,
    content: string,
    mimeType = 'application/json'
  ): Promise<void> {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const desktopFileService = new DesktopFileService();
export const browserFileService = new BrowserFileService();
