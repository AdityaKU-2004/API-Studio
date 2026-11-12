import { ResponseContentTypeCategory } from '../../types';
import { detectContentTypeCategory } from '../../utils/responseDetection';

export interface ParsedResponseBody {
  rawBody: string;
  bodyText: string;
  parsedBody?: unknown;
  sizeBytes: number;
  contentType: string;
  category: ResponseContentTypeCategory;
  isBinary: boolean;
  binaryDataUrl?: string;
  parseError?: string;
}

/**
 * Parses a browser Fetch Response into a structured body representation.
 */
export async function parseFetchResponse(response: Response): Promise<ParsedResponseBody> {
  const contentType = response.headers.get('content-type') || 'text/plain';

  // Read response as ArrayBuffer first to measure exact byte length accurately
  const arrayBuffer = await response.arrayBuffer();
  const sizeBytes = arrayBuffer.byteLength;

  // Initial category detection
  let category = detectContentTypeCategory(contentType);
  const isBinary = ['image', 'audio', 'video', 'pdf', 'binary'].includes(category);

  let binaryDataUrl: string | undefined;
  let rawBody = '';
  let bodyText = '';
  let parsedBody: unknown = undefined;
  let parseError: string | undefined = undefined;

  if (isBinary) {
    // Binary or Image response
    const blob = new Blob([arrayBuffer], { type: contentType });
    binaryDataUrl = URL.createObjectURL(blob);
    rawBody = `[Binary data: ${category.toUpperCase()}, ${sizeBytes} bytes]`;
    bodyText = rawBody;
  } else {
    // Decode text representation
    try {
      const decoder = new TextDecoder('utf-8');
      rawBody = decoder.decode(arrayBuffer);
      bodyText = rawBody;
    } catch {
      rawBody = '[Unable to decode response body as UTF-8]';
      bodyText = rawBody;
    }

    // Refine category if initial mime was generic
    if (category === 'text' && rawBody) {
      category = detectContentTypeCategory(contentType, rawBody);
    }

    // Attempt JSON parsing if category is JSON or looks like JSON
    if (category === 'json' || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
      try {
        parsedBody = JSON.parse(rawBody);
        category = 'json';
      } catch (err) {
        if (category === 'json') {
          parseError = `Response header indicates JSON, but body contains malformed JSON: ${(err as Error).message}`;
        }
      }
    }
  }

  return {
    rawBody,
    bodyText,
    parsedBody,
    sizeBytes,
    contentType,
    category,
    isBinary,
    binaryDataUrl,
    parseError,
  };
}
