import {
  ApiRequest,
  ApiResponse,
  RequestExecutionOptions,
  CertificateInspectionResult,
  WebSocketConfig,
  SseConfig,
  SseEventEntry,
} from '../../types';

/**
 * Clean protocol & platform service contracts designed so Phase 7 Tauri/Rust
 * implementations can swap out browser-restricted transports without rewriting React UI.
 */

export interface IHttpTransport {
  execute(request: ApiRequest, options?: RequestExecutionOptions): Promise<ApiResponse>;
  cancel(tabId: string): void;
  isExecuting(tabId: string): boolean;
}

export interface WebSocketTransportCallbacks {
  onOpen?: (resolvedUrl: string) => void;
  onMessage?: (payload: string, isBinary: boolean, sizeBytes: number) => void;
  onClose?: (code: number, reason: string, wasClean: boolean) => void;
  onError?: (message: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed' | 'disconnected', attempt?: number) => void;
}

export interface IWebSocketTransport {
  connect(
    sessionId: string,
    config: WebSocketConfig,
    resolvedVariables: Record<string, string>,
    callbacks: WebSocketTransportCallbacks
  ): void;
  send(sessionId: string, data: string | ArrayBuffer | Uint8Array): boolean;
  disconnect(sessionId: string, reason?: string): void;
  isConnected(sessionId: string): boolean;
}

export interface SseTransportCallbacks {
  onOpen?: (transport: 'eventsource' | 'fetch', strategy: 'browser-managed' | 'application-managed') => void;
  onEvent?: (event: SseEventEntry) => void;
  onError?: (message: string, fatal?: boolean) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed' | 'disconnected', attempt?: number) => void;
}

export interface ISseTransport {
  connect(
    sessionId: string,
    config: SseConfig,
    resolvedVariables: Record<string, string>,
    callbacks: SseTransportCallbacks
  ): void;
  disconnect(sessionId: string): void;
  isConnected(sessionId: string): boolean;
}

export interface ICertificateInspector {
  readonly mode: 'browser' | 'native-tauri';
  inspect(hostname: string, port?: number): Promise<CertificateInspectionResult>;
}

export interface IFileOperationsService {
  readTextFile(accept?: string): Promise<{ name: string; content: string } | null>;
  saveTextFile(filename: string, content: string, mimeType?: string): Promise<void>;
}

export interface IPersistenceAdapter {
  isNativeSqliteAvailable(): boolean;
  init(): Promise<void>;
}
