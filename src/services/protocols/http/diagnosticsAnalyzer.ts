import {
  ApiRequest,
  ApiResponse,
  AuthConfig,
  KeyValueItem,
  RequestDiagnosticItem,
  RequestPreviewSummary,
} from '../../../types';
import { buildUrlWithParams } from '../../request/urlBuilder';
import { validateRequest } from '../../request/requestValidator';

/**
 * Headers governed by the Fetch specification ("forbidden header names") that browsers
 * automatically strip or override regardless of user configuration.
 */
export const BROWSER_CONTROLLED_HEADERS = [
  'Accept-Charset',
  'Accept-Encoding',
  'Access-Control-Request-Headers',
  'Access-Control-Request-Method',
  'Connection',
  'Content-Length',
  'Cookie',
  'Date',
  'DNT',
  'Expect',
  'Host',
  'Keep-Alive',
  'Origin',
  'Referer',
  'TE',
  'Trailer',
  'Transfer-Encoding',
  'Upgrade',
  'Via',
  'User-Agent (partially restricted in Chromium/Fetch)',
  'Proxy-* / Sec-*',
];

const UNRESOLVED_VAR_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g;

export function findUnresolvedVariables(
  text: string,
  resolvedVariables: Record<string, string>
): string[] {
  if (!text) return [];
  const unresolved = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(UNRESOLVED_VAR_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    const varName = match[1].trim();
    if (!varName.startsWith('$') && !(varName in resolvedVariables)) {
      unresolved.add(varName);
    }
  }
  return Array.from(unresolved);
}

export function substituteVariables(
  text: string,
  resolvedVariables: Record<string, string>
): string {
  if (!text) return text;
  let result = text;
  for (const [k, v] of Object.entries(resolvedVariables)) {
    result = result.replaceAll(`{{${k}}}`, v);
  }
  return result;
}

export function maskSecretValue(value: string): string {
  if (!value) return '';
  if (value.length <= 6) return '••••••';
  return `${value.slice(0, 3)}••••••${value.slice(-2)}`;
}

export function isSensitiveHeaderName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower === 'authorization' ||
    lower === 'proxy-authorization' ||
    lower === 'cookie' ||
    lower === 'set-cookie' ||
    lower.includes('api-key') ||
    lower.includes('apikey') ||
    lower.includes('token') ||
    lower.includes('secret')
  );
}

/**
 * Builds a complete, secret-masked pre-execution request preview.
 */
export function buildRequestPreviewSummary(
  request: ApiRequest,
  resolvedVariables: Record<string, string>,
  effectiveAuth?: AuthConfig,
  effectiveHeaders?: KeyValueItem[],
  authSource = 'Request'
): RequestPreviewSummary {
  const protocol = request.requestType || 'http';
  const rawUrl =
    protocol === 'graphql'
      ? request.graphql?.endpoint || request.url
      : protocol === 'websocket'
      ? request.websocket?.url || request.url
      : protocol === 'sse'
      ? request.sse?.url || request.url
      : request.url;

  const baseUrlWithParams =
    protocol === 'http'
      ? buildUrlWithParams(rawUrl, request.params || [], request.settings?.autoEncodeUrl ?? true)
      : rawUrl;

  const resolvedUrl = substituteVariables(baseUrlWithParams, resolvedVariables);

  const unresolvedSet = new Set<string>([
    ...findUnresolvedVariables(rawUrl, resolvedVariables),
    ...findUnresolvedVariables(baseUrlWithParams, resolvedVariables),
  ]);

  const resolvedParams = (request.params || [])
    .filter((p) => p.enabled && p.key.trim())
    .map((p) => {
      findUnresolvedVariables(p.value, resolvedVariables).forEach((v) => unresolvedSet.add(v));
      return {
        key: substituteVariables(p.key, resolvedVariables),
        value: substituteVariables(p.value, resolvedVariables),
      };
    });

  const headersList = effectiveHeaders || request.headers || [];
  const headersAttempted: RequestPreviewSummary['headersAttempted'] = [];

  for (const h of headersList) {
    if (!h.enabled || !h.key.trim()) continue;
    const resolvedVal = substituteVariables(h.value, resolvedVariables);
    findUnresolvedVariables(h.value, resolvedVariables).forEach((v) => unresolvedSet.add(v));
    const sensitive = isSensitiveHeaderName(h.key);
    headersAttempted.push({
      key: h.key,
      value: sensitive ? maskSecretValue(resolvedVal) : resolvedVal,
      masked: sensitive,
      source: h.description?.startsWith('Inherited') ? h.description : 'Request Header',
    });
  }

  const auth = effectiveAuth || request.auth || { type: 'none' };
  let maskedSummary = 'None';
  if (auth.type === 'bearer' && auth.bearer?.token) {
    const resolvedToken = substituteVariables(auth.bearer.token, resolvedVariables);
    const prefix = auth.bearer.prefix || 'Bearer';
    maskedSummary = `${prefix} ${maskSecretValue(resolvedToken)}`;
    headersAttempted.push({
      key: 'Authorization',
      value: maskedSummary,
      masked: true,
      source: authSource,
    });
  } else if (auth.type === 'basic' && auth.basic?.username) {
    maskedSummary = `Basic (${auth.basic.username}:••••••)`;
    headersAttempted.push({
      key: 'Authorization',
      value: 'Basic ••••••••••',
      masked: true,
      source: authSource,
    });
  } else if (auth.type === 'apikey') {
    const cfg = auth.apikey || auth.apiKey;
    if (cfg && cfg.enabled !== false && cfg.key) {
      const resolvedVal = substituteVariables(cfg.value || '', resolvedVariables);
      maskedSummary = `${cfg.key} (${cfg.addTo || 'header'}): ${maskSecretValue(resolvedVal)}`;
      if ((cfg.addTo || 'header') === 'header') {
        headersAttempted.push({
          key: cfg.key,
          value: maskSecretValue(resolvedVal),
          masked: true,
          source: authSource,
        });
      }
    }
  } else if (auth.type === 'oauth2') {
    const tok = auth.oauth2?.accessToken || auth.oauth2?.token || '';
    maskedSummary = tok ? `OAuth2 (${maskSecretValue(tok)})` : 'OAuth2 (No token)';
  }

  let bodyMode: string = request.body?.mode || request.bodyType || 'none';
  let bodyPreview = '';

  if (protocol === 'graphql') {
    bodyMode = 'graphql';
    let parsedVars: unknown = {};
    try {
      parsedVars = request.graphql?.variablesText?.trim()
        ? JSON.parse(substituteVariables(request.graphql.variablesText, resolvedVariables))
        : {};
    } catch {
      parsedVars = request.graphql?.variablesText || '';
    }
    bodyPreview = JSON.stringify(
      {
        query: substituteVariables(request.graphql?.query || '', resolvedVariables),
        variables: parsedVars,
        ...(request.graphql?.operationName ? { operationName: request.graphql.operationName } : {}),
      },
      null,
      2
    );
  } else if (bodyMode === 'json' || bodyMode === 'text' || bodyMode === 'xml' || bodyMode === 'html') {
    const raw = request.body?.rawContent?.[bodyMode] ?? request.rawBody ?? '';
    bodyPreview = substituteVariables(raw, resolvedVariables);
    findUnresolvedVariables(raw, resolvedVariables).forEach((v) => unresolvedSet.add(v));
  } else if (bodyMode === 'x-www-form-urlencoded') {
    const items = (request.body?.urlEncoded || request.urlEncoded || []).filter((i) => i.enabled && i.key);
    bodyPreview = items
      .map((i) => `${encodeURIComponent(i.key)}=${encodeURIComponent(substituteVariables(i.value, resolvedVariables))}`)
      .join('&');
  }

  const estimatedBodySizeBytes = new TextEncoder().encode(bodyPreview).byteLength;

  return {
    protocol,
    rawUrl,
    resolvedUrl,
    unresolvedVariables: Array.from(unresolvedSet),
    resolvedParams,
    headersAttempted,
    browserControlledHeaders: BROWSER_CONTROLLED_HEADERS,
    authSummary: {
      type: auth.type,
      source: authSource,
      maskedSummary,
    },
    bodyMode,
    bodyPreview,
    estimatedBodySizeBytes,
  };
}

/**
 * Generates actionable, non-misleading diagnostics for a request or failed response.
 */
export function analyzeRequestDiagnostics(
  request: ApiRequest,
  resolvedVariables: Record<string, string>,
  response?: ApiResponse | null
): RequestDiagnosticItem[] {
  const items: RequestDiagnosticItem[] = [];
  const preview = buildRequestPreviewSummary(request, resolvedVariables);

  // 1. Unresolved variables
  if (preview.unresolvedVariables.length > 0) {
    items.push({
      id: 'diag-unresolved-vars',
      category: 'unresolved_variables',
      severity: 'warning',
      title: 'Unresolved Template Variables',
      message: `Variables not defined in active environment or globals: ${preview.unresolvedVariables
        .map((v) => `{{${v}}}`)
        .join(', ')}`,
      suggestions: [
        'Select or create an Environment in the top bar that defines these variable keys.',
        'Or define fallback values in Global Variables.',
      ],
    });
  }

  // 2. Request validation errors (URL, JSON body, Auth config)
  const validationErrors = validateRequest(request);
  for (let i = 0; i < validationErrors.length; i++) {
    const v = validationErrors[i];
    const category =
      v.field === 'url'
        ? 'invalid_url'
        : v.field === 'body'
        ? 'invalid_json_body'
        : v.field === 'auth'
        ? 'auth_config'
        : 'unsupported_browser_behavior';

    items.push({
      id: `diag-val-${i}`,
      category,
      severity: v.severity,
      title:
        v.field === 'url'
          ? 'URL Configuration Issue'
          : v.field === 'body'
          ? 'Body Payload Validation Error'
          : v.field === 'auth'
          ? 'Authentication Configuration Issue'
          : 'Header / Request Notice',
      message: v.message,
      suggestions:
        v.field === 'body'
          ? ['Fix JSON syntax errors in the Body editor before sending.']
          : ['Review the highlighted field configuration.'],
    });
  }

  // 3. Response failure diagnostics
  if (response?.error) {
    const err = response.error;
    if (err.type === 'timeout') {
      items.push({
        id: 'diag-timeout',
        category: 'timeout',
        severity: 'error',
        title: 'Request Timeout',
        message: err.message,
        suggestions: err.troubleshooting || ['Increase timeout in Settings tab.'],
      });
    } else if (err.type === 'abort') {
      items.push({
        id: 'diag-abort',
        category: 'aborted',
        severity: 'warning',
        title: 'Request Aborted',
        message: err.message,
        suggestions: ['Re-send the request when ready.'],
      });
    } else if (err.type === 'invalid_url') {
      items.push({
        id: 'diag-invalid-url',
        category: 'invalid_url',
        severity: 'error',
        title: 'Invalid Target URL',
        message: err.message,
        suggestions: err.troubleshooting || ['Ensure URL includes http:// or https://'],
      });
    } else if (err.type === 'cors') {
      items.push({
        id: 'diag-possible-cors',
        category: 'possible_cors',
        severity: 'error',
        title: 'Browser Fetch Failure (Possible CORS or Reachability Issue)',
        message: err.message,
        suggestions: [
          'Browsers do not expose whether a Fetch TypeError was caused by missing CORS headers, refused TCP connection, TLS error, or DNS failure.',
          ...(err.troubleshooting || []),
        ],
      });
    } else {
      items.push({
        id: 'diag-network',
        category: 'network_error',
        severity: 'error',
        title: 'Network / Execution Error',
        message: err.message,
        suggestions: err.troubleshooting || ['Inspect server availability and network connectivity.'],
      });
    }
  }

  return items;
}
