import { save } from '@tauri-apps/plugin-dialog';
import { DiagnosticLogEntry } from '../../types';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from './tauriBridge';

class DesktopDiagnosticsService {
  public async getLogs(): Promise<DiagnosticLogEntry[]> {
    if (!isTauriRuntime()) return [];
    return invokeDesktop<DiagnosticLogEntry[]>('get_diagnostic_logs');
  }

  public async clearLogs(): Promise<void> {
    if (!isTauriRuntime()) return;
    return invokeDesktop<void>('clear_diagnostic_logs');
  }

  public async exportLogs(): Promise<{ count: number; path: string } | null> {
    if (!isTauriRuntime()) return null;
    const dest = await save({
      title: 'Export Sanitized Desktop Diagnostics Logs',
      defaultPath: `api-studio-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON Log', extensions: ['json', 'log', 'txt'] }],
    });
    if (!dest) return null;
    const count = await invokeDesktop<number>('export_diagnostic_logs', { destPath: dest });
    return { count, path: dest };
  }
}

export const desktopDiagnosticsService = new DesktopDiagnosticsService();
