import { KeyValueItem } from './request';
import { AuthConfig } from './auth';

export type RequestProtocolType = 'http' | 'graphql' | 'websocket' | 'sse';

// ===================== GraphQL =====================

export type GraphQLHttpMethod = 'POST' | 'GET';

export interface GraphQLQueryHistoryEntry {
  id: string;
  query: string;
  variablesText: string;
  endpoint: string;
  operationName?: string;
  executedAt: number;
  durationMs?: number;
  hadErrors?: boolean;
}

export interface GraphQLRequestConfig {
  endpoint: string;
  method: GraphQLHttpMethod;
  query: string;
  variablesText: string;
  operationName?: string;
  queryHistory: GraphQLQueryHistoryEntry[];
}

export interface GraphQLErrorLocation {
  line: number;
  column: number;
}

export interface GraphQLErrorItem {
  message: string;
  locations?: GraphQLErrorLocation[];
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLExecutionResponse {
  id: string;
  httpStatus: number;
  httpStatusText: string;
  headers: Record<string, string>;
  durationMs: number;
  sizeBytes: number;
  rawBody: string;
  data: unknown;
  errors: GraphQLErrorItem[];
  extensions?: Record<string, unknown>;
  isNetworkError?: boolean;
  networkErrorMessage?: string;
  receivedAt: string;
}

export interface GraphQLTypeRef {
  kind: string;
  name: string | null;
  ofType?: GraphQLTypeRef | null;
}

export interface GraphQLSchemaArg {
  name: string;
  description?: string | null;
  type: GraphQLTypeRef;
  defaultValue?: string | null;
}

export interface GraphQLSchemaField {
  name: string;
  description?: string | null;
  args: GraphQLSchemaArg[];
  type: GraphQLTypeRef;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface GraphQLSchemaType {
  kind: 'SCALAR' | 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | string;
  name: string;
  description?: string | null;
  fields?: GraphQLSchemaField[] | null;
  inputFields?: GraphQLSchemaArg[] | null;
  enumValues?: Array<{ name: string; description?: string | null; isDeprecated?: boolean }> | null;
  interfaces?: Array<{ name: string }> | null;
  possibleTypes?: Array<{ name: string }> | null;
}

export interface GraphQLIntrospectionSchema {
  endpoint: string;
  fetchedAt: number;
  queryTypeName?: string | null;
  mutationTypeName?: string | null;
  subscriptionTypeName?: string | null;
  types: GraphQLSchemaType[];
}

// ===================== WebSocket =====================

export type WebSocketConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed';

export type WebSocketMessageFormat = 'text' | 'json' | 'xml' | 'binary';
export type WebSocketMessageDirection = 'sent' | 'received' | 'system';

export interface WebSocketMessageTemplate {
  id: string;
  name: string;
  format: WebSocketMessageFormat;
  payload: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WebSocketMessageEntry {
  id: string;
  timestamp: number;
  direction: WebSocketMessageDirection;
  format: WebSocketMessageFormat;
  payload: string;
  sizeBytes: number;
  status?: 'sent' | 'delivered' | 'received' | 'error';
  isBinary?: boolean;
}

export interface WebSocketConfig {
  url: string;
  protocols: string[];
  connectionTimeoutMs: number;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectDelayMs: number;
  heartbeatEnabled: boolean;
  heartbeatIntervalMs: number;
  heartbeatMessage: string;
  templates: WebSocketMessageTemplate[];
  retainHistory: boolean;
  historyLimit: number;
}

export interface WebSocketSessionState {
  tabId: string;
  status: WebSocketConnectionStatus;
  resolvedUrl?: string;
  connectedAt?: number;
  disconnectedAt?: number;
  reconnectAttempt: number;
  errorMessage?: string;
  closeCode?: number;
  closeReason?: string;
  messages: WebSocketMessageEntry[];
  sentCount: number;
  receivedCount: number;
}

// ===================== Server-Sent Events (SSE) =====================

export type SseConnectionMode = 'auto' | 'eventsource' | 'fetch';
export type SseConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed';

export interface SseEventEntry {
  id: string;
  timestamp: number;
  eventName: string;
  eventId?: string;
  data: string;
  retryMs?: number;
  parsedJson?: unknown;
  rawSizeBytes: number;
}

export interface SseConfig {
  url: string;
  connectionMode: SseConnectionMode;
  withCredentials: boolean;
  headers: KeyValueItem[];
  auth: AuthConfig;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectDelayMs: number;
  retainHistory: boolean;
  historyLimit: number;
}

export interface SseSessionState {
  tabId: string;
  status: SseConnectionStatus;
  activeTransport?: 'eventsource' | 'fetch';
  reconnectStrategy?: 'browser-managed' | 'application-managed';
  resolvedUrl?: string;
  connectedAt?: number;
  disconnectedAt?: number;
  reconnectAttempt: number;
  lastEventId?: string;
  serverRetryMs?: number;
  errorMessage?: string;
  isPaused: boolean;
  events: SseEventEntry[];
  bufferedCount: number;
  totalEventCount: number;
}

// ===================== Persisted Protocol Config Records =====================

export interface SavedProtocolConfig {
  id: string;
  requestId: string;
  protocol: Exclude<RequestProtocolType, 'http'>;
  name: string;
  configJson: string;
  updatedAt: number;
}

export interface SavedSseEventMetadata {
  id: string;
  requestId: string;
  sessionId: string;
  url: string;
  eventCount: number;
  startedAt: number;
  endedAt: number;
  sampleEvents: Array<Pick<SseEventEntry, 'timestamp' | 'eventName' | 'eventId' | 'rawSizeBytes'>>;
  timestamp: number;
}
