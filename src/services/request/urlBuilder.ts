import { KeyValueItem } from '../../types';

export interface ParsedUrlResult {
  baseUrl: string;
  params: KeyValueItem[];
  protocol: string;
  isValid: boolean;
  error?: string;
}

/**
 * Parses a raw URL string, extracts its query parameters into KeyValueItem list,
 * while safely handling template placeholders like {{base_url}}.
 */
export function parseUrl(rawUrl: string, existingParams: KeyValueItem[] = []): ParsedUrlResult {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      baseUrl: '',
      params: existingParams.filter((p) => !p.enabled), // Keep disabled params
      protocol: '',
      isValid: false,
      error: 'URL cannot be empty',
    };
  }

  const trimmed = rawUrl.trim();
  const queryIndex = trimmed.indexOf('?');

  if (queryIndex === -1) {
    // No query string in URL
    // Keep any disabled params that were previously in the table
    const disabledParams = existingParams.filter((p) => !p.enabled);
    return {
      baseUrl: trimmed,
      params: disabledParams,
      protocol: detectProtocol(trimmed),
      isValid: true,
    };
  }

  const baseUrl = trimmed.substring(0, queryIndex);
  const queryString = trimmed.substring(queryIndex + 1);

  // Parse query parameters
  const extractedParams: KeyValueItem[] = [];
  const searchParams = new URLSearchParams(queryString);

  searchParams.forEach((value, key) => {
    // Check if we had an existing description or ID for this key
    const match = existingParams.find((p) => p.key === key && p.value === value);
    extractedParams.push({
      id: match ? match.id : 'p-' + Math.random().toString(36).substring(2, 9),
      key,
      value,
      description: match?.description || '',
      enabled: true,
    });
  });

  // Preserve any disabled parameters from before
  const disabledParams = existingParams.filter((p) => !p.enabled);
  const combinedParams = [...extractedParams, ...disabledParams];

  return {
    baseUrl,
    params: combinedParams,
    protocol: detectProtocol(baseUrl),
    isValid: true,
  };
}

/**
 * Reconstructs a full URL string given a base URL and list of parameters,
 * appending only those that are enabled and non-empty.
 */
export function buildUrlWithParams(baseUrl: string, params: KeyValueItem[], autoEncode = true): string {
  if (!baseUrl) return '';

  // Separate any query string that might already be in baseUrl
  let cleanBase = baseUrl.trim();
  const qIndex = cleanBase.indexOf('?');
  if (qIndex !== -1) {
    cleanBase = cleanBase.substring(0, qIndex);
  }

  const enabledParams = params.filter((p) => p.enabled && p.key.trim() !== '');

  if (enabledParams.length === 0) {
    return cleanBase;
  }

  const queryParts: string[] = [];

  for (const p of enabledParams) {
    const k = autoEncode ? encodeURIComponentSafely(p.key) : p.key;
    const v = autoEncode ? encodeURIComponentSafely(p.value) : p.value;
    queryParts.push(`${k}=${v}`);
  }

  return `${cleanBase}?${queryParts.join('&')}`;
}

/**
 * Helper to encode query parts without corrupting {{variable}} template placeholders.
 */
function encodeURIComponentSafely(str: string): string {
  // If string contains template tags {{var}}, don't encode the curly brackets
  if (str.includes('{{') && str.includes('}}')) {
    return str.replace(/\{\{([^{}]+)\}\}/g, '___VAR_$1___')
      .split('&')
      .map((part) => encodeURIComponent(part))
      .join('&')
      .replace(/___VAR_([^_]+)___/g, '{{$1}}');
  }
  return encodeURIComponent(str);
}

/**
 * Detects protocol or returns empty if relative/variable.
 */
export function detectProtocol(url: string): string {
  if (url.startsWith('https://')) return 'https';
  if (url.startsWith('http://')) return 'http';
  if (url.startsWith('ws://')) return 'ws';
  if (url.startsWith('wss://')) return 'wss';
  return '';
}

/**
 * Automatically ensures a protocol if none is provided.
 */
export function ensureProtocol(url: string, defaultProtocol = 'https://'): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{{') || trimmed.includes('://')) return trimmed;
  return `${defaultProtocol}${trimmed}`;
}
