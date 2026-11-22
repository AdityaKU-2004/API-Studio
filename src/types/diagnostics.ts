import { RequestProtocolType } from './protocols';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type DiagnosticCategory =
  | 'invalid_url'
  | 'invalid_json_body'
  | 'unresolved_variables'
  | 'auth_config'
  | 'timeout'
  | 'aborted'
  | 'network_error'
  | 'possible_cors'
  | 'unsupported_browser_behavior';

export interface RequestDiagnosticItem {
  id: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  title: string;
  message: string;
  suggestions: string[];
}

export type DebugLogCategory = 'http' | 'graphql' | 'websocket' | 'sse' | 'script' | 'system';

export interface RequestPreviewSummary {
  protocol: RequestProtocolType;
  rawUrl: string;
  resolvedUrl: string;
  unresolvedVariables: string[];
  resolvedParams: Array<{ key: string; value: string }>;
  headersAttempted: Array<{ key: string; value: string; masked?: boolean; source: string }>;
  browserControlledHeaders: string[];
  authSummary: {
    type: string;
    source: string;
    maskedSummary: string;
  };
  bodyMode: string;
  bodyPreview: string;
  estimatedBodySizeBytes: number;
}
