import { RequestTiming, NetworkError } from './http';
import { ScriptConsoleEntry, ScriptExecutionError } from './scripting';
import { SchemaValidationResult } from './testing';

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
  id?: string;
  name: string;
  passed: boolean;
  status?: 'passed' | 'failed' | 'skipped';
  message?: string;
  error?: string;
  expected?: string;
  actual?: string;
  durationMs?: number;
  source?: 'script' | 'assertion' | 'schema';
  group?: string;
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
  scriptLogs?: ScriptConsoleEntry[];
  scriptError?: ScriptExecutionError;
  schemaValidation?: SchemaValidationResult;

  error?: NetworkError;
  isBinary?: boolean;
  binaryDataUrl?: string; // object URL for previewing images / downloads
  headerSizeBytes?: number;
  headerSizeEstimated?: boolean;
  contentEncoding?: string;
  tlsVerified?: boolean;
  tlsWarning?: string | null;
  effectiveProxy?: string | null;
  runtimeMode?: 'browser' | 'desktop-tauri';
}
