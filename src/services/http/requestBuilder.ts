import { ApiRequest, HttpRequest, RequestExecutionOptions } from '../../types';

export interface BuiltRequest {
  httpRequest: HttpRequest;
  fetchUrl: string;
  fetchOptions: RequestInit;
  validationError?: string;
}

/**
 * Replaces all {{variable}} patterns in a template string with resolved values.
 */
export function resolveVariables(
  template: string,
  variables: Record<string, string> = {}
): string {
  if (!template) return '';
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Builds an executable HTTP request from the ApiRequest model and environment variables.
 */
export function buildExecutableRequest(
  request: ApiRequest,
  options: RequestExecutionOptions = {}
): BuiltRequest {
  const vars = options.resolvedVariables || {};

  // 1. Resolve and construct URL
  let rawUrl = resolveVariables(request.url.trim(), vars);
  if (!rawUrl) {
    return {
      httpRequest: {
        id: request.id,
        method: request.method,
        url: '',
        headers: {},
      },
      fetchUrl: '',
      fetchOptions: {},
      validationError: 'Request URL is required.',
    };
  }

  // Ensure protocol if not present and no template brackets remaining
  if (!rawUrl.includes('://')) {
    rawUrl = 'https://' + rawUrl;
  }

  let finalUrlObj: URL;
  try {
    finalUrlObj = new URL(rawUrl);
  } catch {
    return {
      httpRequest: {
        id: request.id,
        method: request.method,
        url: rawUrl,
        headers: {},
      },
      fetchUrl: rawUrl,
      fetchOptions: {},
      validationError: `Invalid URL format: "${rawUrl}". Please include a valid protocol (e.g. https://).`,
    };
  }

  // Append enabled query parameters from request.params
  const autoEncode = request.settings?.autoEncodeUrl ?? true;
  if (request.params && request.params.length > 0) {
    for (const param of request.params) {
      if (param.enabled && param.key.trim()) {
        const resolvedKey = resolveVariables(param.key.trim(), vars);
        const resolvedVal = resolveVariables(param.value, vars);
        if (autoEncode) {
          finalUrlObj.searchParams.append(resolvedKey, resolvedVal);
        } else {
          // If autoEncode is false, append manually without re-encoding
          const prefix = finalUrlObj.search ? '&' : '?';
          finalUrlObj.search += `${prefix}${resolvedKey}=${resolvedVal}`;
        }
      }
    }
  }

  // 2. Prepare Headers
  const headers: Record<string, string> = {};
  if (request.headers && request.headers.length > 0) {
    for (const h of request.headers) {
      if (h.enabled && h.key.trim()) {
        const resolvedKey = resolveVariables(h.key.trim(), vars);
        const resolvedVal = resolveVariables(h.value, vars);
        headers[resolvedKey] = resolvedVal;
      }
    }
  }

  // 3. Process Authentication
  const auth = request.auth;
  if (auth) {
    const apiKey = auth.apikey || auth.apiKey;
    if (auth.type === 'apikey' && apiKey && apiKey.enabled !== false && apiKey.key?.trim()) {
      const resolvedKey = resolveVariables(apiKey.key.trim(), vars);
      const resolvedVal = resolveVariables(apiKey.value || '', vars);
      const targetIn = apiKey.in || apiKey.addTo || 'header';

      if (targetIn === 'header') {
        headers[resolvedKey] = resolvedVal;
      } else {
        finalUrlObj.searchParams.append(resolvedKey, resolvedVal);
      }
    } else if (auth.type === 'bearer' && auth.bearer?.token?.trim()) {
      const resolvedToken = resolveVariables(auth.bearer.token.trim(), vars);
      const prefix = auth.bearer.prefix || 'Bearer';
      headers['Authorization'] = `${prefix} ${resolvedToken}`;
    } else if (auth.type === 'basic' && (auth.basic?.username || auth.basic?.password)) {
      const resolvedUser = resolveVariables(auth.basic.username || '', vars);
      const resolvedPass = resolveVariables(auth.basic.password || '', vars);
      const credentials = `${resolvedUser}:${resolvedPass}`;
      try {
        const encoded = btoa(credentials);
        headers['Authorization'] = `Basic ${encoded}`;
      } catch {
        // Fallback for unicode
        const encoded = btoa(unescape(encodeURIComponent(credentials)));
        headers['Authorization'] = `Basic ${encoded}`;
      }
    } else if (auth.type === 'oauth2' && (auth.oauth2?.accessToken?.trim() || auth.oauth2?.token?.trim())) {
      const tokenVal = auth.oauth2.accessToken?.trim() || auth.oauth2.token?.trim() || '';
      const resolvedToken = resolveVariables(tokenVal, vars);
      headers['Authorization'] = `Bearer ${resolvedToken}`;
    }
  }

  // 4. Process Request Body
  let bodyPayload: BodyInit | null = null;
  const method = request.method;
  const supportsBody = !['GET', 'HEAD'].includes(method);

  if (supportsBody) {
    const bodyMode = request.body?.mode || request.bodyType || 'none';

    if (bodyMode === 'json') {
      const rawJson = request.body?.rawContent?.json ?? request.rawBody ?? '';
      const resolvedJson = resolveVariables(rawJson, vars).trim();

      if (resolvedJson) {
        try {
          // Validate JSON syntax
          JSON.parse(resolvedJson);
          bodyPayload = resolvedJson;
          if (!headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
          }
        } catch (jsonErr) {
          return {
            httpRequest: {
              id: request.id,
              method: request.method,
              url: finalUrlObj.toString(),
              headers,
            },
            fetchUrl: finalUrlObj.toString(),
            fetchOptions: {},
            validationError: `JSON Syntax Error in Request Body: ${(jsonErr as Error).message}`,
          };
        }
      }
    } else if (bodyMode === 'text') {
      const text = request.body?.rawContent?.text ?? request.rawBody ?? '';
      bodyPayload = resolveVariables(text, vars);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'text/plain; charset=UTF-8';
      }
    } else if (bodyMode === 'xml') {
      const xml = request.body?.rawContent?.xml ?? request.rawBody ?? '';
      bodyPayload = resolveVariables(xml, vars);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/xml; charset=UTF-8';
      }
    } else if (bodyMode === 'html') {
      const html = request.body?.rawContent?.html ?? request.rawBody ?? '';
      bodyPayload = resolveVariables(html, vars);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'text/html; charset=UTF-8';
      }
    } else if (bodyMode === 'x-www-form-urlencoded') {
      const urlEncodedList = request.body?.urlEncoded || request.urlEncoded || [];
      const formParams = new URLSearchParams();
      for (const item of urlEncodedList) {
        if (item.enabled && item.key.trim()) {
          formParams.append(
            resolveVariables(item.key.trim(), vars),
            resolveVariables(item.value, vars)
          );
        }
      }
      bodyPayload = formParams;
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      }
    } else if (bodyMode === 'form-data') {
      const formDataList = request.body?.formData || request.formData || [];
      const fd = new FormData();
      for (const item of formDataList) {
        if (item.enabled && item.key.trim()) {
          const resolvedKey = resolveVariables(item.key.trim(), vars);
          if (item.type === 'file' && item.file) {
            if (typeof Blob !== 'undefined' && item.file instanceof Blob) {
              fd.append(resolvedKey, item.file, (item.file as File).name || 'file');
            } else {
              const syntheticBlob = new Blob([''], { type: item.file.type || 'application/octet-stream' });
              fd.append(resolvedKey, syntheticBlob, item.file.name || 'file');
            }
          } else {
            fd.append(resolvedKey, resolveVariables(item.value || '', vars));
          }
        }
      }
      bodyPayload = fd;
      // CRITICAL: Do NOT manually set Content-Type header with multipart/form-data.
      // Browser Fetch automatically sets boundary when body is FormData.
      delete headers['Content-Type'];
      delete headers['content-type'];
    } else if (bodyMode === 'binary') {
      const binaryFile = request.body?.binary?.file;
      if (binaryFile) {
        if (typeof Blob !== 'undefined' && binaryFile instanceof Blob) {
          bodyPayload = binaryFile;
        } else {
          bodyPayload = new Blob([''], { type: binaryFile.type || 'application/octet-stream' });
        }
        if (!headers['Content-Type'] && !headers['content-type'] && binaryFile.type) {
          headers['Content-Type'] = binaryFile.type;
        }
      }
    }
  }

  const finalUrl = finalUrlObj.toString();

  // 5. Construct browser Fetch RequestInit
  const fetchOptions: RequestInit = {
    method,
    headers,
    body: supportsBody ? bodyPayload : undefined,
    redirect: request.settings?.followRedirects === false ? 'manual' : 'follow',
    cache: request.settings?.disableCache ? 'no-cache' : 'default',
    signal: options.signal,
  };

  const httpRequest: HttpRequest = {
    id: request.id,
    tabId: options.tabId,
    method,
    url: finalUrl,
    headers,
    body: bodyPayload,
    timeoutMs: options.timeoutMs ?? request.settings?.timeout,
    signal: options.signal,
  };

  return {
    httpRequest,
    fetchUrl: finalUrl,
    fetchOptions,
  };
}
