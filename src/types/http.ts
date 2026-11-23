import { HttpMethod } from './request';

export interface RequestTiming {
  startTime: number;
  headersReceivedTime?: number;
  endTime: number;
  duration: number; // total round-trip duration in ms
  prepareMs: number; // time spent resolving variables and building payload
  dnsLookupMs?: number | null;
  tcpConnectMs?: number | null;
  tlsHandshakeMs?: number | null;
  waitingMs: number; // TTFB (Time to First Byte / server wait)
  downloadMs: number; // time spent reading the response stream
  parsingMs?: number; // time spent decoding/parsing response body
  socketReused?: boolean;
  effectiveProxy?: string | null;
}

export type NetworkErrorType =
  | 'cors'
  | 'timeout'
  | 'abort'
  | 'dns_or_network'
  | 'ssl'
  | 'invalid_url'
  | 'parse_error'
  | 'unknown';

export interface NetworkError {
  type: NetworkErrorType;
  message: string;
  details?: string;
  troubleshooting?: string[];
  status?: number;
}

export interface HttpRequest {
  id: string;
  tabId?: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface RequestExecutionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  tabId?: string;
  resolvedVariables?: Record<string, string>;
  skipScripts?: boolean;
}
