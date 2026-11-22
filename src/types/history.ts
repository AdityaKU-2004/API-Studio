import { HttpMethod, ApiRequest } from './request';
import { RequestProtocolType } from './protocols';

export interface HistoryProtocolMetadata {
  sessionDurationMs?: number;
  messageCount?: number;
  eventCount?: number;
  graphqlErrorsCount?: number;
  operationName?: string;
  capturedEntries?: unknown[];
}

export interface HistoryItem {
  id: string;
  requestId?: string;
  requestName?: string;
  requestType?: RequestProtocolType;
  method: HttpMethod;
  url: string;
  resolvedUrl?: string;
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes?: number;
  timestamp: number;
  executionResult?: 'success' | 'error' | 'cancelled';
  errorSummary?: string;
  request: ApiRequest;
  responseHeaders?: Record<string, string>;
  responseBodySnippet?: string;
  responseBody?: string;
  protocolMetadata?: HistoryProtocolMetadata;
}

export interface HistoryFilterOptions {
  searchQuery: string;
  method: string;
  requestType?: RequestProtocolType | 'ALL';
  statusCodeCategory: 'ALL' | '2xx' | '3xx' | '4xx' | '5xx' | 'ERR';
  sortBy: 'newest' | 'oldest' | 'fastest' | 'slowest';
  dateRange?: 'all' | 'today' | 'week' | 'month';
}
