import {
  ApiRequest,
  ApiResponse,
  EnvironmentVariable,
  SafeScriptRequestContext,
  SafeScriptResponseContext,
  ScriptExecutionContext,
  ScriptStage,
} from '../../types';

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'cookie',
  'set-cookie',
]);

function varListToMap(list: EnvironmentVariable[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of list) {
    if (v.enabled !== false && v.key?.trim()) {
      out[v.key.trim()] = v.currentValue ?? v.initialValue ?? '';
    }
  }
  return out;
}

function collectSecretValues(lists: Array<EnvironmentVariable[] | undefined>, auth?: ApiRequest['auth']): string[] {
  const secrets = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const v of list) {
      if ((v.isSecret || v.secret) && (v.currentValue || v.initialValue)) {
        secrets.add(v.currentValue || v.initialValue);
      }
    }
  }
  if (auth?.bearer?.token) secrets.add(auth.bearer.token);
  if (auth?.basic?.password) secrets.add(auth.basic.password);
  if (auth?.apikey?.value) secrets.add(auth.apikey.value);
  if (auth?.apiKey?.value) secrets.add(auth.apiKey.value);
  if (auth?.oauth2?.accessToken) secrets.add(auth.oauth2.accessToken);
  if (auth?.oauth2?.token) secrets.add(auth.oauth2.token);
  if (auth?.oauth2?.clientSecret) secrets.add(auth.oauth2.clientSecret);
  return Array.from(secrets).filter((s) => s.length >= 2);
}

export function buildSafeRequestContext(request: ApiRequest): SafeScriptRequestContext {
  const headers: Record<string, string> = {};
  for (const h of request.headers || []) {
    if (h.enabled && h.key?.trim()) {
      const lower = h.key.trim().toLowerCase();
      headers[h.key.trim()] = SENSITIVE_HEADER_KEYS.has(lower) ? '••••••••' : h.value;
    }
  }

  const queryParams: Record<string, string> = {};
  for (const p of request.params || []) {
    if (p.enabled && p.key?.trim()) {
      queryParams[p.key.trim()] = p.value;
    }
  }

  let bodyStr = '';
  if (request.bodyType && request.bodyType !== 'none') {
    bodyStr = request.rawBody || '';
  } else if (request.body && request.body.mode !== 'none') {
    bodyStr = request.body.rawContent?.[request.body.mode as keyof typeof request.body.rawContent] || '';
  }

  return {
    id: request.id,
    name: request.name,
    method: request.method,
    url: request.url,
    headers,
    queryParams,
    body: bodyStr,
  };
}

export function buildSafeResponseContext(response?: ApiResponse | null): SafeScriptResponseContext | undefined {
  if (!response) return undefined;
  return {
    code: response.status,
    status: response.statusText,
    responseTime: response.timeMs,
    headers: { ...(response.headers || {}) },
    body: response.body || response.rawBody || '',
    size: response.sizeBytes ?? response.size ?? 0,
  };
}

export interface BuildScriptContextOptions {
  stage: ScriptStage;
  request: ApiRequest;
  response?: ApiResponse | null;
  environmentVariables?: EnvironmentVariable[] | Record<string, string>;
  collectionVariables?: EnvironmentVariable[] | Record<string, string>;
  globalVariables?: EnvironmentVariable[] | Record<string, string>;
  localVariables?: EnvironmentVariable[] | Record<string, string>;
  iterationData?: Record<string, string>;
  secretValues?: string[];
  timeoutMs?: number;
  memoryLimitBytes?: number;
  allowSecretLogging?: boolean;
}

export function buildScriptExecutionContext(opts: BuildScriptContextOptions): ScriptExecutionContext {
  const envMap = Array.isArray(opts.environmentVariables)
    ? varListToMap(opts.environmentVariables)
    : { ...(opts.environmentVariables || {}) };

  const colMap = Array.isArray(opts.collectionVariables)
    ? varListToMap(opts.collectionVariables)
    : { ...(opts.collectionVariables || {}) };

  const globMap = Array.isArray(opts.globalVariables)
    ? varListToMap(opts.globalVariables)
    : { ...(opts.globalVariables || {}) };

  const locMap = Array.isArray(opts.localVariables)
    ? varListToMap(opts.localVariables)
    : { ...(opts.localVariables || {}) };

  const varLists = [
    Array.isArray(opts.environmentVariables) ? opts.environmentVariables : undefined,
    Array.isArray(opts.collectionVariables) ? opts.collectionVariables : undefined,
    Array.isArray(opts.globalVariables) ? opts.globalVariables : undefined,
    Array.isArray(opts.localVariables) ? opts.localVariables : undefined,
  ];

  const collected = collectSecretValues(varLists, opts.request.auth);
  const mergedSecrets = Array.from(
    new Set([...collected, ...(opts.secretValues || []).filter((s) => s && s.length >= 2)])
  );

  return {
    stage: opts.stage,
    requestId: opts.request.id,
    timeoutMs: opts.timeoutMs ?? 3000,
    memoryLimitBytes: opts.memoryLimitBytes ?? 16 * 1024 * 1024,
    request: buildSafeRequestContext(opts.request),
    response: buildSafeResponseContext(opts.response),
    environmentVariables: envMap,
    collectionVariables: colMap,
    globalVariables: globMap,
    localVariables: locMap,
    iterationData: opts.iterationData ? { ...opts.iterationData } : {},
    secretValues: mergedSecrets,
    allowSecretLogging: opts.allowSecretLogging ?? false,
  };
}
