import { ApiResponse, ResponseCookie, RequestTiming } from '../../types';
import { ParsedResponseBody } from './responseParser';

/**
 * Normalizes browser Fetch headers into a standard dictionary.
 */
export function extractHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    // Preserve header case or standard format
    result[key] = value;
  });
  return result;
}

/**
 * Parses accessible cookies from document.cookie (if applicable) or response context.
 * Note: Browsers prohibit JS from reading Set-Cookie headers on cross-origin requests.
 */
export function extractAccessibleCookies(url: string): ResponseCookie[] {
  const cookies: ResponseCookie[] = [];

  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const parsedUrl = new URL(url);
      const isSameHost =
        typeof window !== 'undefined' && window.location.hostname === parsedUrl.hostname;

      if (isSameHost) {
        const pairs = document.cookie.split(';');
        for (const pair of pairs) {
          const [rawName, rawVal] = pair.trim().split('=');
          if (rawName) {
            cookies.push({
              name: rawName,
              value: decodeURIComponent(rawVal || ''),
              domain: parsedUrl.hostname,
              path: '/',
              httpOnly: false, // Accessible to JS
            });
          }
        }
      }
    }
  } catch {
    // Ignore cookie parsing error
  }

  return cookies;
}

/**
 * Normalizes fetch execution results into the canonical ApiResponse model.
 */
export function normalizeResponse(
  executionId: string,
  requestId: string,
  method: string,
  finalUrl: string,
  fetchResponse: Response,
  parsedBody: ParsedResponseBody,
  timing: RequestTiming
): ApiResponse {
  const headers = extractHeaders(fetchResponse.headers);
  const cookies = extractAccessibleCookies(finalUrl);

  return {
    id: executionId,
    requestId,
    status: fetchResponse.status,
    statusText: fetchResponse.statusText || (fetchResponse.ok ? 'OK' : 'Error'),
    ok: fetchResponse.ok,
    url: finalUrl,
    method,
    headers,
    body: parsedBody.bodyText,
    rawBody: parsedBody.rawBody,
    parsedBody: parsedBody.parsedBody,
    contentType: parsedBody.contentType,
    contentTypeCategory: parsedBody.category,
    size: parsedBody.sizeBytes,
    sizeBytes: parsedBody.sizeBytes,
    timeMs: timing.duration,
    timing,
    receivedAt: new Date(timing.endTime).toISOString(),
    timestamp: timing.endTime,
    cookies,
    tests: [],
    isBinary: parsedBody.isBinary,
    binaryDataUrl: parsedBody.binaryDataUrl,
  };
}
