import { ApiRequest, JwtBearerAuth, OAuth2Auth } from '../../types';
import { httpClient } from '../http/httpClient';
import { isTauriRuntime } from '../runtime/capabilities';
import { desktopSecurityService } from '../desktop/securityService';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is unavailable in this environment.');
}

/**
 * Generates a high-entropy PKCE code_verifier (43-128 URL-safe chars)
 * and its SHA-256 S256 code_challenge + anti-CSRF state value.
 */
export async function generatePkcePair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  method: 'S256';
  state: string;
}> {
  const cryptoApi = getCrypto();
  const verifierBytes = new Uint8Array(32);
  cryptoApi.getRandomValues(verifierBytes);
  const codeVerifier = base64UrlEncode(verifierBytes);

  const encoder = new TextEncoder();
  const digest = await cryptoApi.subtle.digest('SHA-256', encoder.encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  const stateBytes = new Uint8Array(16);
  cryptoApi.getRandomValues(stateBytes);
  const state = base64UrlEncode(stateBytes);

  return {
    codeVerifier,
    codeChallenge,
    method: 'S256',
    state,
  };
}

export function buildOAuthAuthorizationUrl(oauth2: OAuth2Auth): string {
  if (!oauth2.authUrl?.trim()) {
    throw new Error('Authorization URL is required.');
  }
  const url = new URL(oauth2.authUrl.trim());
  url.searchParams.set('response_type', 'code');
  if (oauth2.clientId) url.searchParams.set('client_id', oauth2.clientId);
  if (oauth2.redirectUri) url.searchParams.set('redirect_uri', oauth2.redirectUri);
  if (oauth2.scope) url.searchParams.set('scope', oauth2.scope);
  if (oauth2.state) url.searchParams.set('state', oauth2.state);

  if (oauth2.grantType === 'authorization_code_pkce' && oauth2.pkceChallenge) {
    url.searchParams.set('code_challenge', oauth2.pkceChallenge);
    url.searchParams.set('code_challenge_method', oauth2.pkceMethod || 'S256');
  }
  return url.toString();
}

export function validateOAuthStateParameter(expectedState: string, returnedState: string): boolean {
  if (!expectedState || !returnedState) return false;
  if (expectedState.length !== returnedState.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedState.length; i++) {
    diff |= expectedState.charCodeAt(i) ^ returnedState.charCodeAt(i);
  }
  return diff === 0;
}

export async function requestOAuth2Token(
  oauth2: OAuth2Auth,
  overrideGrant?: OAuth2Auth['grantType']
): Promise<{
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number;
}> {
  const tokenUrl = oauth2.accessTokenUrl?.trim();
  if (!tokenUrl) {
    throw new Error('Access Token URL is required.');
  }

  const grantType = overrideGrant || oauth2.grantType;
  const formItems: Array<{ id: string; key: string; value: string; enabled: boolean }> = [];
  const pushParam = (key: string, value: string) => {
    formItems.push({ id: `oa-${formItems.length}`, key, value, enabled: true });
  };

  if (grantType === 'client_credentials') {
    pushParam('grant_type', 'client_credentials');
    if (oauth2.scope) pushParam('scope', oauth2.scope);
  } else if (grantType === 'refresh_token') {
    if (!oauth2.refreshToken) {
      throw new Error('Refresh token is missing.');
    }
    pushParam('grant_type', 'refresh_token');
    pushParam('refresh_token', oauth2.refreshToken);
    if (oauth2.scope) pushParam('scope', oauth2.scope);
  } else if (grantType === 'authorization_code' || grantType === 'authorization_code_pkce') {
    if (!oauth2.authorizationCode?.trim()) {
      throw new Error('Authorization code is required to exchange for a token.');
    }
    pushParam('grant_type', 'authorization_code');
    pushParam('code', oauth2.authorizationCode.trim());
    if (oauth2.redirectUri) pushParam('redirect_uri', oauth2.redirectUri);
    if (grantType === 'authorization_code_pkce' && oauth2.pkceVerifier) {
      pushParam('code_verifier', oauth2.pkceVerifier);
    }
  } else if (grantType === 'password') {
    pushParam('grant_type', 'password');
    if (oauth2.username) pushParam('username', oauth2.username);
    if (oauth2.password) pushParam('password', oauth2.password);
    if (oauth2.scope) pushParam('scope', oauth2.scope);
  }

  const headers: ApiRequest['headers'] = [
    { id: 'h-ct', key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true },
    { id: 'h-accept', key: 'Accept', value: 'application/json', enabled: true },
  ];

  if (oauth2.clientAuthMethod === 'header' && oauth2.clientId) {
    const basicCred = btoa(`${oauth2.clientId}:${oauth2.clientSecret || ''}`);
    headers.push({
      id: 'h-basic',
      key: 'Authorization',
      value: `Basic ${basicCred}`,
      enabled: true,
    });
  } else {
    if (oauth2.clientId) pushParam('client_id', oauth2.clientId);
    if (oauth2.clientSecret && grantType !== 'authorization_code_pkce') {
      pushParam('client_secret', oauth2.clientSecret);
    }
  }

  const req: ApiRequest = {
    id: `oauth-token-${Date.now()}`,
    name: 'OAuth 2.0 Token Exchange',
    requestType: 'http',
    method: 'POST',
    url: tokenUrl,
    params: [],
    headers,
    auth: { type: 'none' },
    body: {
      mode: 'x-www-form-urlencoded',
      rawContent: { json: '', text: '', xml: '', html: '' },
      formData: [],
      urlEncoded: formItems,
      binary: {},
    },
    bodyType: 'x-www-form-urlencoded',
    rawBody: '',
    formData: [],
    urlEncoded: formItems,
    scripts: {
      preRequest: { script: '', enabled: false },
      postResponse: { script: '', enabled: false },
    },
    preRequestScript: '',
    testScript: '',
    settings: {
      timeout: 15000,
      followRedirects: true,
      maxRedirects: 5,
      autoEncodeUrl: true,
      sslVerification: true,
      allowInsecureCertificates: false,
      httpVersion: 'auto',
      connectionTimeout: 5000,
      keepAlive: true,
      disableCache: true,
      followAuthRedirects: true,
      customUserAgent: 'API-Studio/2.0',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const resp = await httpClient.execute(req);
  if (resp.error || !resp.ok) {
    throw new Error(
      resp.error?.message || `Token endpoint returned HTTP ${resp.status} ${resp.statusText}`
    );
  }

  let json: Record<string, unknown>;
  const rawRespBody = resp.body || resp.rawBody || '';
  try {
    json = JSON.parse(rawRespBody || '{}');
  } catch {
    const params = new URLSearchParams(rawRespBody);
    json = Object.fromEntries(params.entries());
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  if (!accessToken) {
    throw new Error('Token response did not contain an access_token field.');
  }

  const expiresInSec =
    typeof json.expires_in === 'number'
      ? json.expires_in
      : typeof json.expires_in === 'string'
        ? Number(json.expires_in)
        : undefined;

  const result = {
    accessToken,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : oauth2.refreshToken,
    tokenType: typeof json.token_type === 'string' ? json.token_type : 'Bearer',
    expiresAt:
      expiresInSec && Number.isFinite(expiresInSec) ? Date.now() + expiresInSec * 1000 : undefined,
  };

  // Store sensitive refresh/access tokens in OS keyring if running on desktop
  if (isTauriRuntime() && oauth2.credentialRef) {
    await desktopSecurityService
      .storeSecret(
        oauth2.credentialRef,
        JSON.stringify({ accessToken: result.accessToken, refreshToken: result.refreshToken })
      )
      .catch(() => {});
  }

  return result;
}

/**
 * Generates an HMAC-SHA256/384/512 signed JWT for JWT Bearer auth.
 */
export async function generateJwtToken(jwtConfig: JwtBearerAuth): Promise<string> {
  if (jwtConfig.algorithm === 'RS256') {
    throw new Error(
      'Client-side RSA PEM signing is not enabled in the browser JWT helper; provide a pre-signed JWT or use HS256/HS384/HS512.'
    );
  }

  const hashAlg =
    jwtConfig.algorithm === 'HS512'
      ? 'SHA-512'
      : jwtConfig.algorithm === 'HS384'
        ? 'SHA-384'
        : 'SHA-256';

  const headerObj = jwtConfig.headerJson?.trim()
    ? JSON.parse(jwtConfig.headerJson)
    : { alg: jwtConfig.algorithm, typ: 'JWT' };
  headerObj.alg = jwtConfig.algorithm;
  headerObj.typ = headerObj.typ || 'JWT';

  const nowSec = Math.floor(Date.now() / 1000);
  const payloadObj = jwtConfig.payloadJson?.trim()
    ? JSON.parse(jwtConfig.payloadJson)
    : { sub: 'api-studio-client' };
  if (payloadObj.iat === undefined) payloadObj.iat = nowSec;
  if (jwtConfig.expiresInSeconds && payloadObj.exp === undefined) {
    payloadObj.exp = nowSec + jwtConfig.expiresInSeconds;
  }

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(headerObj)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payloadObj)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const cryptoApi = getCrypto();
  const key = await cryptoApi.subtle.importKey(
    'raw',
    enc.encode(jwtConfig.secretOrPrivateKey || ''),
    { name: 'HMAC', hash: hashAlg },
    false,
    ['sign']
  );

  const signature = await cryptoApi.subtle.sign('HMAC', key, enc.encode(signingInput));
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${sigB64}`;
}

export function isOAuthTokenExpired(expiresAt?: number, skewMs = 30000): boolean {
  if (!expiresAt) return false;
  return Date.now() + skewMs >= expiresAt;
}
