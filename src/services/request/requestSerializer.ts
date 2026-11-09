import { ApiRequest, RequestDefinition } from '../../types';

export function serializeRequestToJson(request: ApiRequest, pretty = true): string {
  // Normalize request for clean JSON representation
  const clean: RequestDefinition = {
    id: request.id,
    name: request.name,
    method: request.method,
    url: request.url,
    params: request.params || [],
    headers: request.headers || [],
    auth: request.auth || { type: 'none' },
    body: request.body || {
      mode: request.bodyType || 'none',
      rawContent: {
        json: request.rawBody || '',
        text: request.rawBody || '',
        xml: request.rawBody || '',
        html: request.rawBody || '',
      },
      formData: request.formData || [],
      urlEncoded: request.urlEncoded || [],
      binary: {},
    },
    scripts: request.scripts || {
      preRequest: { script: request.preRequestScript || '', enabled: true },
      postResponse: { script: request.testScript || '', enabled: true },
    },
    settings: request.settings || {
      timeout: 10000,
      followRedirects: true,
      maxRedirects: 5,
      autoEncodeUrl: true,
      sslVerification: true,
      allowInsecureCertificates: false,
      httpVersion: 'auto',
      connectionTimeout: 5000,
      keepAlive: true,
      disableCache: false,
      followAuthRedirects: true,
      customUserAgent: 'API Studio/2.0',
    },
    createdAt: request.createdAt || Date.now(),
    updatedAt: Date.now(),
    collectionId: request.collectionId,
    folderId: request.folderId,
  };

  return JSON.stringify(clean, null, pretty ? 2 : 0);
}

export function deserializeRequestFromJson(jsonString: string): { success: boolean; request?: ApiRequest; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Parsed content is not a valid JSON object' };
    }

    if (!parsed.url && !parsed.name) {
      return { success: false, error: 'JSON does not appear to be an API Studio request definition' };
    }

    const id = parsed.id || 'req-' + Date.now();
    const name = parsed.name || 'Imported Request';
    const method = parsed.method || 'GET';
    const url = parsed.url || '{{base_url}}/';

    // Support both new RequestDefinition format and legacy Phase 1 format
    const bodyType = parsed.bodyType || parsed.body?.mode || 'none';
    const rawBody = parsed.rawBody || parsed.body?.rawContent?.[bodyType] || '';
    const preRequestScript = parsed.preRequestScript || parsed.scripts?.preRequest?.script || '';
    const testScript = parsed.testScript || parsed.scripts?.postResponse?.script || '';

    const req: ApiRequest = {
      id,
      name,
      method,
      url,
      params: Array.isArray(parsed.params) ? parsed.params : [],
      headers: Array.isArray(parsed.headers) ? parsed.headers : [],
      auth: parsed.auth || { type: 'none' },
      bodyType,
      rawBody,
      formData: Array.isArray(parsed.formData) ? parsed.formData : (parsed.body?.formData || []),
      urlEncoded: Array.isArray(parsed.urlEncoded) ? parsed.urlEncoded : (parsed.body?.urlEncoded || []),
      preRequestScript,
      testScript,
      body: parsed.body || {
        mode: bodyType,
        rawContent: {
          json: rawBody,
          text: rawBody,
          xml: rawBody,
          html: rawBody,
        },
        formData: parsed.formData || [],
        urlEncoded: parsed.urlEncoded || [],
        binary: parsed.body?.binary || {},
      },
      scripts: parsed.scripts || {
        preRequest: { script: preRequestScript, enabled: true },
        postResponse: { script: testScript, enabled: true },
      },
      settings: parsed.settings || {
        timeout: 10000,
        followRedirects: true,
        maxRedirects: 5,
        autoEncodeUrl: true,
        sslVerification: true,
        allowInsecureCertificates: false,
        httpVersion: 'auto',
        connectionTimeout: 5000,
        keepAlive: true,
        disableCache: false,
        followAuthRedirects: true,
        customUserAgent: 'API Studio/2.0',
      },
      createdAt: parsed.createdAt || Date.now(),
      updatedAt: Date.now(),
      collectionId: parsed.collectionId,
      folderId: parsed.folderId,
    };

    return { success: true, request: req };
  } catch (err) {
    return { success: false, error: `Invalid JSON format: ${err instanceof Error ? err.message : String(err)}` };
  }
}
