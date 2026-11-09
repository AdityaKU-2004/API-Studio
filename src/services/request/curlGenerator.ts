import { ApiRequest } from '../../types';
import { buildUrlWithParams } from './urlBuilder';

export interface CurlGeneratorOptions {
  includeAuthSecret?: boolean;
  resolvedVariables?: Record<string, string>;
  multiline?: boolean;
}

/**
 * Generates an executable, formatted cURL command string from an ApiRequest.
 */
export function generateCurlCommand(
  request: ApiRequest,
  options: CurlGeneratorOptions = {}
): string {
  const { multiline = true, resolvedVariables = {} } = options;
  const separator = multiline ? ' \\\n  ' : ' ';

  // 1. Resolve URL with query params
  let finalUrl = buildUrlWithParams(request.url, request.params, request.settings?.autoEncodeUrl ?? true);

  // Substitute variables if provided
  for (const [key, val] of Object.entries(resolvedVariables)) {
    finalUrl = finalUrl.replaceAll(`{{${key}}}`, val);
  }

  const parts: string[] = ['curl'];

  // Add location redirect flag if enabled
  if (request.settings?.followRedirects) {
    parts.push('--location');
  }

  // Method (GET is default in curl, but explicit is clear)
  parts.push(`--request ${request.method}`);

  // URL
  parts.push(`'${escapeShell(finalUrl)}'`);

  // Headers (enabled only)
  const enabledHeaders = request.headers.filter((h) => h.enabled && h.key.trim() !== '');

  for (const h of enabledHeaders) {
    let val = h.value;
    for (const [k, v] of Object.entries(resolvedVariables)) {
      val = val.replaceAll(`{{${k}}}`, v);
    }
    parts.push(`--header '${escapeShell(h.key)}: ${escapeShell(val)}'`);
  }

  // Authentication header injection if configured
  if (request.auth) {
    if (request.auth.type === 'bearer' && request.auth.bearer?.token) {
      let token = request.auth.bearer.token;
      for (const [k, v] of Object.entries(resolvedVariables)) {
        token = token.replaceAll(`{{${k}}}`, v);
      }
      parts.push(`--header 'Authorization: ${request.auth.bearer.prefix || 'Bearer'} ${escapeShell(token)}'`);
    } else if (request.auth.type === 'apikey' && request.auth.apikey?.enabled && request.auth.apikey.addTo === 'header' && request.auth.apikey.key) {
      let val = request.auth.apikey.value;
      for (const [k, v] of Object.entries(resolvedVariables)) {
        val = val.replaceAll(`{{${k}}}`, v);
      }
      parts.push(`--header '${escapeShell(request.auth.apikey.key)}: ${escapeShell(val)}'`);
    } else if (request.auth.type === 'basic' && request.auth.basic?.username) {
      parts.push(`--user '${escapeShell(request.auth.basic.username)}:${escapeShell(request.auth.basic.password || '')}'`);
    }
  }

  // Body
  if (request.bodyType === 'json' && request.rawBody) {
    parts.push(`--data-raw '${escapeShell(request.rawBody)}'`);
  } else if (request.bodyType === 'text' && request.rawBody) {
    parts.push(`--data '${escapeShell(request.rawBody)}'`);
  } else if (request.bodyType === 'xml' && request.rawBody) {
    parts.push(`--data '${escapeShell(request.rawBody)}'`);
  } else if (request.bodyType === 'x-www-form-urlencoded' && request.urlEncoded) {
    const encodedPairs = request.urlEncoded
      .filter((item) => item.enabled && item.key)
      .map((item) => `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`);
    if (encodedPairs.length > 0) {
      parts.push(`--data '${encodedPairs.join('&')}'`);
    }
  } else if (request.bodyType === 'form-data' && request.formData) {
    for (const item of request.formData.filter((f) => f.enabled && f.key)) {
      if (item.type === 'file') {
        parts.push(`--form '${escapeShell(item.key)}=@${escapeShell(item.value || 'file.bin')}'`);
      } else {
        parts.push(`--form '${escapeShell(item.key)}=${escapeShell(item.value)}'`);
      }
    }
  }

  return parts.join(separator);
}

function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''");
}
