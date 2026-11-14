import { HttpMethod, ApiRequest } from './request';

export interface HistoryItem {
  id: string;
  requestId?: string;
  requestName?: string;
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
}

export interface HistoryFilterOptions {
  searchQuery: string;
  method: string;
  statusCodeCategory: 'ALL' | '2xx' | '3xx' | '4xx' | '5xx' | 'ERR';
  sortBy: 'newest' | 'oldest' | 'fastest' | 'slowest';
  dateRange?: 'all' | 'today' | 'week' | 'month';
}
