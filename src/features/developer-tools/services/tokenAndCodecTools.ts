export interface DecodedJwtResult {
  validStructure: boolean;
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  signatureSegment: string;
  algorithm?: string;
  tokenType?: string;
  issuer?: string;
  audience?: string | string[];
  subject?: string;
  issuedAtIso?: string;
  expiresAtIso?: string;
  notBeforeIso?: string;
  expirationStatus: 'valid' | 'expired' | 'not_yet_valid' | 'no_exp' | 'unknown';
  signatureVerified: false;
  securityNotice: string;
  error?: string;
}

function decodeBase64Url(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Decodes a JWT locally in the browser without transmitting tokens anywhere.
 * Never performs or claims cryptographic signature verification without a verified key.
 */
export function decodeJwtLocal(token: string): DecodedJwtResult {
  const baseSecurityNotice =
    'Decoding a JWT only inspects its Base64URL header and payload locally. Cryptographic signature verification requires the signing key/secret and algorithm check.';

  const trimmed = (token || '').trim();
  if (!trimmed) {
    return {
      validStructure: false,
      header: null,
      payload: null,
      signatureSegment: '',
      expirationStatus: 'unknown',
      signatureVerified: false,
      securityNotice: baseSecurityNotice,
      error: 'Paste a JWT token to decode.',
    };
  }

  const cleanToken = trimmed.toLowerCase().startsWith('bearer ')
    ? trimmed.slice(7).trim()
    : trimmed;

  const parts = cleanToken.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    return {
      validStructure: false,
      header: null,
      payload: null,
      signatureSegment: parts[2] || '',
      expirationStatus: 'unknown',
      signatureVerified: false,
      securityNotice: baseSecurityNotice,
      error: `Invalid JWT structure: expected 3 dot-separated segments (header.payload.signature), got ${parts.length}.`,
    };
  }

  try {
    const header = JSON.parse(decodeBase64Url(parts[0])) as Record<string, unknown>;
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;

    const nowSec = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
    const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
    const nbf = typeof payload.nbf === 'number' ? payload.nbf : undefined;

    let expirationStatus: DecodedJwtResult['expirationStatus'] = 'no_exp';
    if (exp !== undefined && nowSec >= exp) {
      expirationStatus = 'expired';
    } else if (nbf !== undefined && nowSec < nbf) {
      expirationStatus = 'not_yet_valid';
    } else if (exp !== undefined) {
      expirationStatus = 'valid';
    }

    return {
      validStructure: true,
      header,
      payload,
      signatureSegment: parts[2],
      algorithm: typeof header.alg === 'string' ? header.alg : undefined,
      tokenType: typeof header.typ === 'string' ? header.typ : undefined,
      issuer: typeof payload.iss === 'string' ? payload.iss : undefined,
      audience:
        typeof payload.aud === 'string' || Array.isArray(payload.aud)
          ? (payload.aud as string | string[])
          : undefined,
      subject: typeof payload.sub === 'string' ? payload.sub : undefined,
      issuedAtIso: iat !== undefined ? new Date(iat * 1000).toISOString() : undefined,
      expiresAtIso: exp !== undefined ? new Date(exp * 1000).toISOString() : undefined,
      notBeforeIso: nbf !== undefined ? new Date(nbf * 1000).toISOString() : undefined,
      expirationStatus,
      signatureVerified: false,
      securityNotice: baseSecurityNotice,
    };
  } catch (err) {
    return {
      validStructure: false,
      header: null,
      payload: null,
      signatureSegment: parts[2] || '',
      expirationStatus: 'unknown',
      signatureVerified: false,
      securityNotice: baseSecurityNotice,
      error: err instanceof Error ? `Failed to decode JWT segments: ${err.message}` : 'Invalid JWT encoding',
    };
  }
}

export function encodeBase64Unicode(text: string): { success: boolean; output: string; error?: string } {
  try {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { success: true, output: btoa(binary) };
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : 'Base64 encoding failed',
    };
  }
}

export function decodeBase64Unicode(base64: string): { success: boolean; output: string; error?: string } {
  const cleaned = (base64 || '').trim().replace(/\s+/g, '');
  if (!cleaned) return { success: true, output: '' };

  // Support URL-safe Base64 variants too, while validating characters
  const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    return { success: false, output: '', error: 'Malformed Base64 input string.' };
  }

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { success: true, output: decoded };
  } catch {
    return {
      success: false,
      output: '',
      error: 'Invalid Base64 data or non-UTF-8 byte sequence.',
    };
  }
}

export function encodeUrlValue(input: string, mode: 'component' | 'full'): { success: boolean; output: string; error?: string } {
  try {
    return {
      success: true,
      output: mode === 'component' ? encodeURIComponent(input) : encodeURI(input),
    };
  } catch (err) {
    return { success: false, output: '', error: err instanceof Error ? err.message : 'URL encode error' };
  }
}

export function decodeUrlValue(input: string, mode: 'component' | 'full'): { success: boolean; output: string; error?: string } {
  try {
    return {
      success: true,
      output: mode === 'component' ? decodeURIComponent(input) : decodeURI(input),
    };
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err instanceof Error ? `Malformed URI encoding: ${err.message}` : 'URL decode error',
    };
  }
}

export function parseQueryParametersString(input: string): Array<{ key: string; value: string }> {
  const trimmed = (input || '').trim();
  if (!trimmed) return [];
  const queryPart = trimmed.includes('?') ? trimmed.split('?').slice(1).join('?') : trimmed.replace(/^\?/, '');
  const params = new URLSearchParams(queryPart);
  const result: Array<{ key: string; value: string }> = [];
  params.forEach((value, key) => {
    result.push({ key, value });
  });
  return result;
}

export function formatQueryParametersString(
  baseUrl: string,
  params: Array<{ key: string; value: string }>
): string {
  const search = new URLSearchParams();
  for (const p of params) {
    if (p.key.trim()) search.append(p.key, p.value);
  }
  const qs = search.toString();
  const base = (baseUrl || '').split('?')[0].trim();
  if (!base) return qs ? `?${qs}` : '';
  return qs ? `${base}?${qs}` : base;
}
