import { ApiResponse } from '../../types';

export interface ResponseSizeBreakdown {
  bodyBytes: number;
  bodyMeasurement: 'exact';
  exposedHeadersBytes: number;
  headersMeasurement: 'estimated';
  totalExposedBytes: number;
  contentType: string;
  contentEncoding: string | null;
  browserNotes: string[];
}

export function analyzeResponseSize(response: ApiResponse): ResponseSizeBreakdown {
  const bodyBytes = response.sizeBytes ?? response.size ?? 0;

  let exposedHeadersBytes = response.headerSizeBytes;
  if (exposedHeadersBytes === undefined) {
    const serialized = Object.entries(response.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    exposedHeadersBytes = serialized ? new TextEncoder().encode(serialized).byteLength : 0;
  }

  const contentEncoding =
    response.contentEncoding ||
    response.headers?.['content-encoding'] ||
    response.headers?.['Content-Encoding'] ||
    null;

  return {
    bodyBytes,
    bodyMeasurement: 'exact',
    exposedHeadersBytes,
    headersMeasurement: 'estimated',
    totalExposedBytes: bodyBytes + exposedHeadersBytes,
    contentType: response.contentType || 'unknown',
    contentEncoding,
    browserNotes: [
      'Body size is measured accurately from the decoded response ArrayBuffer.',
      'Header size is estimated strictly from CORS-exposed headers readable by Fetch (browsers hide restricted headers such as Set-Cookie).',
      'On-the-wire compressed transfer size is omitted unless exposed via Resource Timing on same-origin or Timing-Allow-Origin endpoints.',
    ],
  };
}
