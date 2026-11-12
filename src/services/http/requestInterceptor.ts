import { ApiRequest } from '../../types';

export interface SanitizedRequestSummary {
  method: string;
  url: string;
  headers: Record<string, string>;
  authType: string;
}

/**
 * Sanitizes headers and authentication info to remove sensitive tokens and passwords before logging.
 */
export function sanitizeRequestForLogging(request: ApiRequest): SanitizedRequestSummary {
  const safeHeaders: Record<string, string> = {};

  if (request.headers) {
    for (const h of request.headers) {
      if (!h.enabled || !h.key.trim()) continue;
      const lowerKey = h.key.toLowerCase();
      if (
        lowerKey.includes('auth') ||
        lowerKey.includes('key') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password')
      ) {
        safeHeaders[h.key] = '••••••••';
      } else {
        safeHeaders[h.key] = h.value;
      }
    }
  }

  // Remove credentials from URL query if apiKey is present
  let sanitizedUrl = request.url;
  try {
    const urlObj = new URL(request.url.includes('://') ? request.url : `https://${request.url}`);
    const apiKey = request.auth?.apikey || request.auth?.apiKey;
    if (request.auth?.type === 'apikey' && apiKey && (apiKey.in === 'query' || apiKey.addTo === 'query')) {
      const paramName = apiKey.key;
      if (paramName && urlObj.searchParams.has(paramName)) {
        urlObj.searchParams.set(paramName, '••••••••');
        sanitizedUrl = urlObj.toString();
      }
    }
  } catch {
    // Keep sanitizedUrl
  }

  return {
    method: request.method,
    url: sanitizedUrl,
    headers: safeHeaders,
    authType: request.auth?.type || 'none',
  };
}
