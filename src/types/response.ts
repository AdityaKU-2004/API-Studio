import { RequestTiming, NetworkError } from './http';

export interface ResponseCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  durationMs?: number;
}

export type ResponseContentTypeCategory =
  | 'json'
  | 'xml'
  | 'html'
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'pdf'
  | 'binary'
  | 'unknown';

export interface ApiResponse {
  id: string; // unique execution ID
  requestId: string; // original request ID

  status: number;
  statusText: string;
  ok: boolean;

  url: string;
  method: string;

  headers: Record<string, string>;

  body: string; // text representation
  rawBody: string;
  parsedBody?: unknown; // parsed JSON object if json

  contentType: string;
  contentTypeCategory: ResponseContentTypeCategory;
  size: number; // size in bytes
  sizeBytes: number; // compatibility alias

  timeMs: number; // total duration
  timing: RequestTiming;

  receivedAt: string; // formatted or ISO timestamp
  timestamp: number;

  cookies: ResponseCookie[];
  tests: TestResult[];

  error?: NetworkError;
  isBinary?: boolean;
  binaryDataUrl?: string; // object URL for previewing images / downloads
}
