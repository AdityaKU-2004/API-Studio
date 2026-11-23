export type RuntimeMode = 'browser' | 'desktop-tauri';

export interface RuntimeCapabilities {
  mode: RuntimeMode;
  isDesktop: boolean;
  isTauri: boolean;
  corsBypassAvailable: boolean;
  supportsSqliteStorage: boolean;
  supportsNativeKeyring: boolean;
  supportsCustomProxy: boolean;
  supportsCustomTlsCertificates: boolean;
  supportsCertificateInspection: boolean;
  supportsNativeFileDialogs: boolean;
  supportsSocketTiming: boolean;
  supportsGraphqlSubscriptions: boolean;
}

export interface DesktopAppError {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
}

export interface NativeProxyConfig {
  enabled: boolean;
  protocol: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  credentialRef?: string;
  bypassList: string[];
}

export interface NativeTlsConfig {
  verifySsl: boolean;
  customCaPem?: string;
  clientCertPem?: string;
  clientKeyPem?: string;
}

export interface NativeHttpFormPart {
  key: string;
  partType: 'text' | 'file';
  value?: string;
  fileName?: string;
  contentType?: string;
  base64Data?: string;
  filePath?: string;
}

export interface NativeHttpRequestPayload {
  executionId: string;
  tabId: string;
  requestId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyMode: 'none' | 'raw' | 'x-www-form-urlencoded' | 'form-data' | 'binary';
  rawBody?: string;
  formUrlEncoded: Array<[string, string]>;
  formParts: NativeHttpFormPart[];
  binaryBase64?: string;
  binaryFilePath?: string;
  timeoutMs?: number;
  followRedirects: boolean;
  maxRedirects?: number;
  tls?: NativeTlsConfig;
  proxy?: NativeProxyConfig;
}

export interface NativeTimingBreakdown {
  startTime: number;
  headersReceivedTime: number;
  endTime: number;
  durationMs: number;
  prepareMs: number;
  dnsLookupMs: number | null;
  tcpConnectMs: number | null;
  tlsHandshakeMs: number | null;
  ttfbMs: number;
  downloadMs: number;
  socketReused: boolean;
  effectiveProxy?: string | null;
}

export interface NativeHttpResponsePayload {
  executionId: string;
  requestId: string;
  status: number;
  statusText: string;
  ok: boolean;
  finalUrl: string;
  method: string;
  headers: Record<string, string>;
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: string;
    httpOnly: boolean;
    secure: boolean;
  }>;
  bodyText: string | null;
  bodyBase64: string | null;
  isBinary: boolean;
  contentType: string;
  contentEncoding?: string | null;
  sizeBytes: number;
  headerSizeBytes: number;
  timing: NativeTimingBreakdown;
  tlsVerified: boolean;
  tlsWarning?: string | null;
  receivedAt: string;
}

export interface DatabaseStatus {
  initialized: boolean;
  dbPath: string;
  schemaVersion: number;
  tableCounts: Record<string, number>;
}

export interface MigrationReport {
  success: boolean;
  importedCounts: Record<string, number>;
  skippedCounts: Record<string, number>;
  verifiedDbCounts: Record<string, number>;
  durationMs: number;
}

export interface IndexedDbInspectionSummary {
  hasLegacyData: boolean;
  totalRecords: number;
  counts: {
    collections: number;
    folders: number;
    requests: number;
    environments: number;
    globalVariables: number;
    history: number;
    testSuites: number;
    testReports: number;
    scriptTemplates: number;
    jsonSchemas: number;
    protocolConfigs: number;
  };
}

export interface KeyringStatus {
  available: boolean;
  backend: string;
  error?: string;
}

export interface DiagnosticLogEntry {
  id: string;
  timestamp: number;
  level: string;
  component: string;
  message: string;
}

export interface NativeReadFileResult {
  path: string;
  fileName: string;
  sizeBytes: number;
  contentUtf8: string | null;
  contentBase64: string;
  isBinary: boolean;
}
