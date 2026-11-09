import { ApiRequest, ValidationError } from '../../types';

export function validateRequest(request: ApiRequest): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. URL validation
  if (!request.url || !request.url.trim()) {
    errors.push({
      field: 'url',
      message: 'Request URL is empty',
      severity: 'error',
    });
  } else {
    const trimmed = request.url.trim();
    // Allow variable templates like {{base_url}} or standard protocols
    if (
      !trimmed.startsWith('{{') &&
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('ws://') &&
      !trimmed.startsWith('wss://')
    ) {
      errors.push({
        field: 'url',
        message: 'URL is missing protocol (e.g. https://). Default https:// will be assumed.',
        severity: 'warning',
      });
    }
  }

  // 2. Headers validation & conflicts
  const headerKeysSeen = new Map<string, number>();
  for (const h of request.headers) {
    if (h.enabled && h.key.trim()) {
      const lower = h.key.trim().toLowerCase();
      const count = (headerKeysSeen.get(lower) || 0) + 1;
      headerKeysSeen.set(lower, count);

      if (count > 1) {
        errors.push({
          field: 'headers',
          message: `Duplicate header: "${h.key}". Only one will take precedence.`,
          severity: 'warning',
        });
      }
    }
  }

  // Check auth conflict: if auth header is set in both Auth tab and Headers tab
  if (request.auth && request.auth.type !== 'none' && request.auth.type !== 'inherit') {
    const hasExplicitAuthHeader = request.headers.some(
      (h) => h.enabled && h.key.trim().toLowerCase() === 'authorization'
    );
    if (hasExplicitAuthHeader) {
      errors.push({
        field: 'headers',
        message: 'Explicit "Authorization" header in Headers tab may conflict with settings in Authorization tab.',
        severity: 'warning',
      });
    }
  }

  // 3. Authentication validation
  if (request.auth) {
    if (request.auth.type === 'bearer') {
      if (!request.auth.bearer?.token?.trim()) {
        errors.push({
          field: 'auth',
          message: 'Bearer token is empty in Authorization tab.',
          severity: 'warning',
        });
      }
    } else if (request.auth.type === 'apikey') {
      if (!request.auth.apikey?.key?.trim()) {
        errors.push({
          field: 'auth',
          message: 'API Key name is missing in Authorization tab.',
          severity: 'error',
        });
      }
    } else if (request.auth.type === 'basic') {
      if (!request.auth.basic?.username?.trim()) {
        errors.push({
          field: 'auth',
          message: 'Basic Auth username is missing in Authorization tab.',
          severity: 'warning',
        });
      }
    } else if (request.auth.type === 'oauth2') {
      if (!request.auth.oauth2?.accessTokenUrl?.trim()) {
        errors.push({
          field: 'auth',
          message: 'OAuth 2.0 Access Token URL is required.',
          severity: 'warning',
        });
      }
    }
  }

  // 4. Body validation (JSON / XML)
  if (request.bodyType === 'json' && request.rawBody && request.rawBody.trim()) {
    try {
      JSON.parse(request.rawBody);
    } catch (err) {
      errors.push({
        field: 'body',
        message: `Invalid JSON body: ${err instanceof Error ? err.message : 'Syntax error'}`,
        severity: 'error',
      });
    }
  } else if (request.bodyType === 'xml' && request.rawBody && request.rawBody.trim()) {
    const trimmed = request.rawBody.trim();
    if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
      errors.push({
        field: 'body',
        message: 'Invalid XML structure (must start with < and end with >)',
        severity: 'warning',
      });
    }
  }

  return errors;
}
