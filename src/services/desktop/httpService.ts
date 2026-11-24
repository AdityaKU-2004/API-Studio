import {
  ApiRequest,
  ApiResponse,
  NativeHttpFormPart,
  NativeHttpRequestPayload,
  NativeHttpResponsePayload,
  RequestExecutionOptions,
  ResponseContentTypeCategory,
} from '../../types';
import { IHttpTransport } from '../protocols/contracts';
import { resolveVariables } from '../http/requestBuilder';
import { invokeDesktop, normalizeDesktopError } from './tauriBridge';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function detectContentCategory(contentType: string): ResponseContentTypeCategory {
  const ct = contentType.toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml') || ct.includes('svg')) return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.startsWith('text/')) return 'text';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('audio/')) return 'audio';
  if (ct.startsWith('video/')) return 'video';
  if (ct.includes('pdf')) return 'pdf';
  return 'binary';
}

export async function serializeRequestToNativePayload(
  request: ApiRequest,
  options: RequestExecutionOptions,
  executionId: string,
  tabId: string
): Promise<{ payload?: NativeHttpRequestPayload; validationError?: string }> {
  const vars = options.resolvedVariables || {};
  let rawUrl = resolveVariables((request.url || '').trim(), vars);
  if (!rawUrl) {
    return { validationError: 'Request URL is required.' };
  }
  if (!rawUrl.includes('://')) {
    rawUrl = 'https://' + rawUrl;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return {
      validationError: `Invalid URL format: "${rawUrl}". Include a valid protocol (e.g. https://).`,
    };
  }

  const autoEncode = request.settings?.autoEncodeUrl ?? true;
  for (const param of request.params || []) {
    if (param.enabled && param.key.trim()) {
      const k = resolveVariables(param.key.trim(), vars);
      const v = resolveVariables(param.value, vars);
      if (autoEncode) {
        parsedUrl.searchParams.append(k, v);
      } else {
        const prefix = parsedUrl.search ? '&' : '?';
        parsedUrl.search += `${prefix}${k}=${v}`;
      }
    }
  }

  const headers: Record<string, string> = {};
  for (const h of request.headers || []) {
    if (h.enabled && h.key.trim()) {
      headers[resolveVariables(h.key.trim(), vars)] = resolveVariables(h.value, vars);
    }
  }

  if (request.settings?.customUserAgent?.trim() && !headers['User-Agent'] && !headers['user-agent']) {
    headers['User-Agent'] = request.settings.customUserAgent.trim();
  }
  if (request.settings?.disableCache && !headers['Cache-Control'] && !headers['cache-control']) {
    headers['Cache-Control'] = 'no-cache';
  }

  const auth = request.auth;
  if (auth) {
    const apiKey = auth.apikey || auth.apiKey;
    if (auth.type === 'apikey' && apiKey && apiKey.enabled !== false && apiKey.key?.trim()) {
      const akKey = resolveVariables(apiKey.key.trim(), vars);
      const akVal = resolveVariables(apiKey.value || '', vars);
      if ((apiKey.in || apiKey.addTo || 'header') === 'header') {
        headers[akKey] = akVal;
      } else {
        parsedUrl.searchParams.append(akKey, akVal);
      }
    } else if (auth.type === 'bearer' && auth.bearer?.token?.trim()) {
      const token = resolveVariables(auth.bearer.token.trim(), vars);
      headers['Authorization'] = `${auth.bearer.prefix || 'Bearer'} ${token}`;
    } else if (auth.type === 'basic' && (auth.basic?.username || auth.basic?.password)) {
      const u = resolveVariables(auth.basic.username || '', vars);
      const p = resolveVariables(auth.basic.password || '', vars);
      headers['Authorization'] = `Basic ${btoa(unescape(encodeURIComponent(`${u}:${p}`)))}`;
    } else if (auth.type === 'oauth2' && (auth.oauth2?.accessToken?.trim() || auth.oauth2?.token?.trim())) {
      const tok = resolveVariables(
        auth.oauth2.accessToken?.trim() || auth.oauth2.token?.trim() || '',
        vars
      );
      const tokenType = auth.oauth2.tokenType || 'Bearer';
      headers['Authorization'] = `${tokenType} ${tok}`;
    } else if (auth.type === 'jwt' && auth.jwt?.generatedToken?.trim()) {
      const jwtTok = resolveVariables(auth.jwt.generatedToken.trim(), vars);
      if (auth.jwt.addTo === 'query') {
        parsedUrl.searchParams.append(auth.jwt.queryParamName?.trim() || 'token', jwtTok);
      } else {
        headers['Authorization'] = `${auth.jwt.headerPrefix || 'Bearer'} ${jwtTok}`;
      }
    }
  }

  let bodyMode: NativeHttpRequestPayload['bodyMode'] = 'none';
  let rawBody: string | undefined;
  const formUrlEncoded: Array<[string, string]> = [];
  const formParts: NativeHttpFormPart[] = [];
  let binaryBase64: string | undefined;

  const supportsBody = !['GET', 'HEAD'].includes(request.method);
  if (supportsBody) {
    const mode = request.body?.mode || request.bodyType || 'none';
    if (mode === 'json' || mode === 'text' || mode === 'xml' || mode === 'html') {
      bodyMode = 'raw';
      const content =
        request.body?.rawContent?.[mode] ?? request.rawBody ?? '';
      rawBody = resolveVariables(content, vars);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] =
          mode === 'json'
            ? 'application/json'
            : mode === 'xml'
            ? 'application/xml; charset=UTF-8'
            : mode === 'html'
            ? 'text/html; charset=UTF-8'
            : 'text/plain; charset=UTF-8';
      }
    } else if (mode === 'x-www-form-urlencoded') {
      bodyMode = 'x-www-form-urlencoded';
      for (const item of request.body?.urlEncoded || request.urlEncoded || []) {
        if (item.enabled && item.key.trim()) {
          formUrlEncoded.push([
            resolveVariables(item.key.trim(), vars),
            resolveVariables(item.value, vars),
          ]);
        }
      }
    } else if (mode === 'form-data') {
      bodyMode = 'form-data';
      for (const item of request.body?.formData || request.formData || []) {
        if (!item.enabled || !item.key.trim()) continue;
        const key = resolveVariables(item.key.trim(), vars);
        if (item.type === 'file' && item.file) {
          let b64 = '';
          if (typeof Blob !== 'undefined' && item.file instanceof Blob) {
            const buf = await item.file.arrayBuffer();
            b64 = arrayBufferToBase64(buf);
          }
          formParts.push({
            key,
            partType: 'file',
            fileName: item.file.name || 'file.bin',
            contentType: item.file.type || 'application/octet-stream',
            base64Data: b64,
          });
        } else {
          formParts.push({
            key,
            partType: 'text',
            value: resolveVariables(item.value || '', vars),
          });
        }
      }
    } else if (mode === 'binary') {
      bodyMode = 'binary';
      const binFile = request.body?.binary?.file;
      if (binFile && typeof Blob !== 'undefined' && binFile instanceof Blob) {
        binaryBase64 = arrayBufferToBase64(await binFile.arrayBuffer());
        if (!headers['Content-Type'] && !headers['content-type'] && binFile.type) {
          headers['Content-Type'] = binFile.type;
        }
      }
    }
  }

  // Certificate verification ALWAYS defaults to true unless explicitly disabled
  const sslVerifySetting = request.settings?.sslVerification ?? true;
  const allowInsecure = request.settings?.allowInsecureCertificates ?? false;
  const verifySsl = sslVerifySetting && !allowInsecure;

  return {
    payload: {
      executionId,
      tabId,
      requestId: request.id,
      method: request.method,
      url: parsedUrl.toString(),
      headers,
      bodyMode,
      rawBody,
      formUrlEncoded,
      formParts,
      binaryBase64,
      timeoutMs: options.timeoutMs ?? request.settings?.timeout ?? 30000,
      followRedirects: request.settings?.followRedirects ?? true,
      maxRedirects: request.settings?.maxRedirects ?? 10,
      tls: {
        verifySsl,
        customCaPem:
          (auth?.type === 'mtls' ? auth.mtls?.caCertPem : undefined) ||
          request.settings?.customCaPem,
        clientCertPem:
          (auth?.type === 'mtls' ? auth.mtls?.clientCertPem : undefined) ||
          request.settings?.clientCertPem,
        clientKeyPem:
          (auth?.type === 'mtls' ? auth.mtls?.clientKeyPem : undefined) ||
          request.settings?.clientKeyPem,
      },
      proxy: request.settings?.proxy,
    },
  };
}

export class DesktopHttpService implements IHttpTransport {
  private activeTabs = new Set<string>();

  public async execute(
    request: ApiRequest,
    options: RequestExecutionOptions = {}
  ): Promise<ApiResponse> {
    const tabId = options.tabId || 'default-tab';
    const executionId = 'exec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    const serialized = await serializeRequestToNativePayload(request, options, executionId, tabId);
    if (serialized.validationError || !serialized.payload) {
      return this.buildErrorResponse(
        executionId,
        request,
        'invalid_url',
        serialized.validationError || 'Invalid HTTP request configuration',
        0
      );
    }

    this.activeTabs.add(tabId);
    const startTs = Date.now();
    try {
      const nativeResp = await invokeDesktop<NativeHttpResponsePayload>('execute_http_request', {
        request: serialized.payload,
      });
      this.activeTabs.delete(tabId);

      const category = detectContentCategory(nativeResp.contentType);
      const rawText = nativeResp.bodyText ?? '';
      let parsedBody: unknown = undefined;
      let formattedBody = rawText;

      if (category === 'json' && rawText.trim()) {
        try {
          parsedBody = JSON.parse(rawText);
          formattedBody = JSON.stringify(parsedBody, null, 2);
        } catch {
          // leave raw
        }
      }

      const binaryDataUrl =
        nativeResp.isBinary && nativeResp.bodyBase64
          ? `data:${nativeResp.contentType};base64,${nativeResp.bodyBase64}`
          : undefined;

      return {
        id: nativeResp.executionId,
        requestId: nativeResp.requestId,
        status: nativeResp.status,
        statusText: nativeResp.statusText,
        ok: nativeResp.ok,
        url: nativeResp.finalUrl,
        method: nativeResp.method,
        headers: nativeResp.headers,
        body: nativeResp.isBinary ? `[Binary payload: ${nativeResp.sizeBytes} bytes]` : formattedBody,
        rawBody: rawText,
        parsedBody,
        contentType: nativeResp.contentType,
        contentTypeCategory: category,
        size: nativeResp.sizeBytes,
        sizeBytes: nativeResp.sizeBytes,
        timeMs: nativeResp.timing.durationMs,
        timing: {
          startTime: nativeResp.timing.startTime,
          headersReceivedTime: nativeResp.timing.headersReceivedTime,
          endTime: nativeResp.timing.endTime,
          duration: nativeResp.timing.durationMs,
          prepareMs: nativeResp.timing.prepareMs,
          dnsLookupMs: nativeResp.timing.dnsLookupMs,
          tcpConnectMs: nativeResp.timing.tcpConnectMs,
          tlsHandshakeMs: nativeResp.timing.tlsHandshakeMs,
          waitingMs: nativeResp.timing.ttfbMs,
          downloadMs: nativeResp.timing.downloadMs,
          socketReused: nativeResp.timing.socketReused,
          effectiveProxy: nativeResp.timing.effectiveProxy,
        },
        receivedAt: nativeResp.receivedAt,
        timestamp: Date.now(),
        cookies: nativeResp.cookies,
        tests: [],
        isBinary: nativeResp.isBinary,
        binaryDataUrl,
        headerSizeBytes: nativeResp.headerSizeBytes,
        headerSizeEstimated: false,
        contentEncoding: nativeResp.contentEncoding || undefined,
        tlsVerified: nativeResp.tlsVerified,
        tlsWarning: nativeResp.tlsWarning,
        effectiveProxy: nativeResp.timing.effectiveProxy,
        runtimeMode: 'desktop-tauri',
      };
    } catch (err) {
      this.activeTabs.delete(tabId);
      const desktopErr = normalizeDesktopError(err);
      const errType =
        desktopErr.code === 'REQUEST_CANCELLED'
          ? 'abort'
          : desktopErr.code === 'REQUEST_TIMEOUT'
          ? 'timeout'
          : desktopErr.code.includes('TLS')
          ? 'ssl'
          : desktopErr.code === 'INVALID_URL'
          ? 'invalid_url'
          : 'dns_or_network';

      return this.buildErrorResponse(
        executionId,
        request,
        errType,
        desktopErr.message,
        Date.now() - startTs,
        desktopErr.details
      );
    }
  }

  public cancel(tabId: string): void {
    this.activeTabs.delete(tabId);
    void invokeDesktop<boolean>('cancel_http_request', { tabId }).catch(() => {});
  }

  public isExecuting(tabId: string): boolean {
    return this.activeTabs.has(tabId);
  }

  private buildErrorResponse(
    executionId: string,
    request: ApiRequest,
    type: 'cors' | 'timeout' | 'abort' | 'dns_or_network' | 'ssl' | 'invalid_url' | 'parse_error' | 'unknown',
    message: string,
    durationMs: number,
    details?: string
  ): ApiResponse {
    const now = Date.now();
    return {
      id: executionId,
      requestId: request.id,
      status: 0,
      statusText: type.toUpperCase(),
      ok: false,
      url: request.url,
      method: request.method,
      headers: {},
      body: JSON.stringify({ error: type, message, details }, null, 2),
      rawBody: message,
      contentType: 'application/json',
      contentTypeCategory: 'json',
      size: 0,
      sizeBytes: 0,
      timeMs: durationMs,
      timing: {
        startTime: now - durationMs,
        endTime: now,
        duration: durationMs,
        prepareMs: 0,
        waitingMs: 0,
        downloadMs: 0,
      },
      receivedAt: new Date(now).toISOString(),
      timestamp: now,
      cookies: [],
      tests: [],
      runtimeMode: 'desktop-tauri',
      error: {
        type,
        message,
        details,
      },
    };
  }
}

export const desktopHttpService = new DesktopHttpService();
