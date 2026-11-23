import { isTauri } from '@tauri-apps/api/core';
import { RuntimeCapabilities } from '../../types';

export function isTauriRuntime(win: any = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win) return false;
  if (typeof win.__TAURI_INTERNALS__ !== 'undefined') return true;
  if (typeof win.__TAURI__ !== 'undefined') return true;
  try {
    return typeof isTauri === 'function' && isTauri();
  } catch {
    return false;
  }
}

export function detectRuntimeCapabilities(
  win: any = typeof window !== 'undefined' ? window : undefined
): RuntimeCapabilities {
  const isDesktop = isTauriRuntime(win);
  return {
    mode: isDesktop ? 'desktop-tauri' : 'browser',
    isDesktop,
    isTauri: isDesktop,
    corsBypassAvailable: isDesktop,
    supportsSqliteStorage: isDesktop,
    supportsNativeKeyring: isDesktop,
    supportsCustomProxy: isDesktop,
    supportsCustomTlsCertificates: isDesktop,
    supportsCertificateInspection: isDesktop,
    supportsNativeFileDialogs: isDesktop,
    supportsSocketTiming: isDesktop,
    supportsGraphqlSubscriptions: isDesktop,
  };
}
