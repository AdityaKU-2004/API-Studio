import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { DesktopAppError } from '../../types';
import { isTauriRuntime } from '../runtime/capabilities';

export interface TauriBridgeAdapter {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn>;
}

let testBridgeOverride: TauriBridgeAdapter | null = null;

/**
 * Allows automated unit tests to inject a mock IPC bridge without Tauri native binaries.
 */
export function setTauriTestBridge(adapter: TauriBridgeAdapter | null): void {
  testBridgeOverride = adapter;
}

export function normalizeDesktopError(err: unknown): DesktopAppError {
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.code === 'string' && typeof obj.message === 'string') {
      return {
        code: obj.code,
        message: obj.message,
        details: typeof obj.details === 'string' ? obj.details : undefined,
        recoverable: typeof obj.recoverable === 'boolean' ? obj.recoverable : true,
      };
    }
  }
  if (err instanceof Error) {
    return {
      code: 'DESKTOP_IPC_ERROR',
      message: err.message,
      recoverable: true,
    };
  }
  return {
    code: 'DESKTOP_IPC_ERROR',
    message: typeof err === 'string' ? err : 'Unexpected desktop IPC error',
    recoverable: true,
  };
}

export async function invokeDesktop<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (testBridgeOverride) {
    return testBridgeOverride.invoke<T>(command, args);
  }
  if (!isTauriRuntime()) {
    throw normalizeDesktopError({
      code: 'TAURI_UNAVAILABLE',
      message: `Command '${command}' requires the API Studio Desktop runtime.`,
      recoverable: true,
    });
  }
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    throw normalizeDesktopError(err);
  }
}

export async function listenDesktop<T>(
  event: string,
  handler: (payload: T) => void
): Promise<UnlistenFn> {
  if (testBridgeOverride) {
    return testBridgeOverride.listen<T>(event, handler);
  }
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<T>(event, (ev) => handler(ev.payload));
}
