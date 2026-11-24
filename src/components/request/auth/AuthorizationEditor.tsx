import React, { useState } from 'react';
import { AuthType, JwtBearerAuth, MutualTlsAuth, OAuth2Auth, OAuth2GrantType } from '../../../types';
import { useRequestStore } from '../../../stores/requestStore';
import { useAuthStore } from '../../../stores/authStore';
import {
  buildOAuthAuthorizationUrl,
  generateJwtToken,
  generatePkcePair,
  isOAuthTokenExpired,
  requestOAuth2Token,
} from '../../../services/auth/oauthService';
import {
  Key,
  Shield,
  Lock,
  Layers,
  Eye,
  EyeOff,
  RotateCcw,
  Info,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
} from 'lucide-react';

const DEFAULT_OAUTH2: OAuth2Auth = {
  grantType: 'authorization_code',
  authUrl: '',
  accessTokenUrl: '',
  clientId: '',
  clientSecret: '',
  scope: '',
  redirectUri: 'https://localhost:3000/oauth/callback',
  state: '',
  clientAuthMethod: 'header',
  pkceMethod: 'S256',
};

const DEFAULT_JWT: JwtBearerAuth = {
  algorithm: 'HS256',
  secretOrPrivateKey: '',
  payloadJson: JSON.stringify({ sub: 'api-studio-user', role: 'developer' }, null, 2),
  headerJson: JSON.stringify({ alg: 'HS256', typ: 'JWT' }, null, 2),
  addTo: 'header',
  headerPrefix: 'Bearer',
  queryParamName: 'token',
  expiresInSeconds: 3600,
  generatedToken: '',
};

const DEFAULT_MTLS: MutualTlsAuth = {
  clientCertPem: '',
  clientKeyPem: '',
  caCertPem: '',
  passphrase: '',
  serverName: '',
};

export const AuthorizationEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const { resolveEffectiveAuth } = useAuthStore();

  const [showBearerToken, setShowBearerToken] = useState(false);
  const [showBasicPassword, setShowBasicPassword] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showJwtSecret, setShowJwtSecret] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [jwtStatus, setJwtStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const auth = request.auth || { type: 'none' };
  const effectiveInfo = resolveEffectiveAuth(auth, request.collectionId, request.folderId);

  const updateOAuth2 = (patch: Partial<OAuth2Auth>) => {
    updateActiveRequest({
      auth: {
        ...auth,
        oauth2: {
          ...DEFAULT_OAUTH2,
          ...(auth.oauth2 || {}),
          ...patch,
        },
      },
    });
  };

  const updateJwt = (patch: Partial<JwtBearerAuth>) => {
    updateActiveRequest({
      auth: {
        ...auth,
        jwt: {
          ...DEFAULT_JWT,
          ...(auth.jwt || {}),
          ...patch,
        },
      },
    });
  };

  const updateMtls = (patch: Partial<MutualTlsAuth>) => {
    updateActiveRequest({
      auth: {
        ...auth,
        mtls: {
          ...DEFAULT_MTLS,
          ...(auth.mtls || {}),
          ...patch,
        },
      },
    });
  };

  const handleTypeChange = (type: AuthType) => {
    updateActiveRequest({
      auth: {
        ...auth,
        type,
        apikey: auth.apikey || { key: 'X-API-Key', value: '', addTo: 'header', enabled: true },
        bearer: auth.bearer || { token: '', prefix: 'Bearer', visible: false },
        basic: auth.basic || { username: '', password: '', visible: false },
        oauth2: auth.oauth2 || { ...DEFAULT_OAUTH2 },
        jwt: auth.jwt || { ...DEFAULT_JWT },
        mtls: auth.mtls || { ...DEFAULT_MTLS },
      },
    });
  };

  const handleGeneratePkce = async () => {
    try {
      const pair = await generatePkcePair();
      updateOAuth2({
        pkceVerifier: pair.codeVerifier,
        pkceChallenge: pair.codeChallenge,
        pkceMethod: pair.method,
        state: pair.state,
      });
      setOauthStatus({ type: 'ok', msg: 'Generated SHA-256 PKCE verifier, challenge & anti-CSRF state.' });
    } catch (err) {
      setOauthStatus({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Failed to generate PKCE pair',
      });
    }
  };

  const handleCopyAuthUrl = async () => {
    try {
      const current = { ...DEFAULT_OAUTH2, ...(auth.oauth2 || {}) };
      const url = buildOAuthAuthorizationUrl(current);
      await navigator.clipboard.writeText(url);
      setOauthStatus({ type: 'ok', msg: 'Authorization URL copied to clipboard.' });
    } catch (err) {
      setOauthStatus({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Cannot build Authorization URL',
      });
    }
  };

  const handleFetchOAuthToken = async (overrideGrant?: OAuth2GrantType) => {
    setOauthLoading(true);
    setOauthStatus(null);
    try {
      const current = { ...DEFAULT_OAUTH2, ...(auth.oauth2 || {}) };
      const res = await requestOAuth2Token(current, overrideGrant);
      updateOAuth2({
        accessToken: res.accessToken,
        token: res.accessToken,
        refreshToken: res.refreshToken || current.refreshToken,
        tokenType: res.tokenType,
        expiresAt: res.expiresAt,
        lastRefreshedAt: Date.now(),
      });
      setOauthStatus({
        type: 'ok',
        msg: overrideGrant === 'refresh_token' ? 'OAuth token refreshed.' : 'Access token acquired and attached.',
      });
    } catch (err) {
      setOauthStatus({
        type: 'err',
        msg: err instanceof Error ? err.message : 'OAuth token request failed',
      });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleGenerateJwt = async () => {
    setJwtStatus(null);
    try {
      const current = { ...DEFAULT_JWT, ...(auth.jwt || {}) };
      const signed = await generateJwtToken(current);
      updateJwt({ generatedToken: signed });
      setJwtStatus({ type: 'ok', msg: `Signed ${current.algorithm} JWT token generated.` });
    } catch (err) {
      setJwtStatus({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Failed to generate JWT token',
      });
    }
  };

  const oauthExpired = isOAuthTokenExpired(auth.oauth2?.expiresAt);

  return (
    <div className="p-4 space-y-5 text-xs select-none max-w-3xl">
      {/* Type Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h4 className="text-xs font-semibold text-slate-200">Authentication Protocol</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Configure request credentials, OAuth 2.0 PKCE, signed JWT Bearer tokens, or Mutual TLS.
          </p>
        </div>

        <select
          value={auth.type}
          onChange={(e) => handleTypeChange(e.target.value as AuthType)}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-medium focus:outline-none focus:border-cyan-400 cursor-pointer"
        >
          <option value="inherit">Inherit from Parent</option>
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="jwt">JWT Bearer (HS256/384/512)</option>
          <option value="apikey">API Key</option>
          <option value="basic">Basic Auth</option>
          <option value="oauth2">OAuth 2.0 (+ PKCE)</option>
          <option value="mtls">Mutual TLS (Client Cert)</option>
        </select>
      </div>

      {/* Inheritance Notification Banner */}
      {auth.type === 'inherit' && (
        <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2">
          <div className="flex items-center gap-2 text-cyan-300 font-medium">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Inheriting from: {effectiveInfo.sourceName}</span>
          </div>
          <p className="text-slate-300 text-xs">
            This request inherits its credentials from its parent container. Effective auth scheme:{' '}
            <span className="font-mono text-cyan-400 font-semibold uppercase">
              {effectiveInfo.effectiveAuth.type}
            </span>
          </p>
          {effectiveInfo.effectiveAuth.type === 'none' && (
            <p className="text-[11px] text-slate-400">
              No authorization credentials are configured on the parent collection.
            </p>
          )}
        </div>
      )}

      {/* Credentials Panels */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
        {auth.type === 'none' && (
          <div className="py-8 text-center text-slate-500 space-y-1">
            <Shield className="w-8 h-8 mx-auto text-slate-600 stroke-1" />
            <p className="text-slate-300 font-medium">No Authentication</p>
            <p className="text-[11px] text-slate-500">
              This request does not include any authorization headers or authentication parameters.
            </p>
          </div>
        )}

        {auth.type === 'bearer' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <Key className="w-4 h-4" />
                <span>Bearer Token Configuration</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateActiveRequest({
                    auth: {
                      ...auth,
                      bearer: { ...(auth.bearer || { prefix: 'Bearer' }), token: '' },
                    },
                  })
                }
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Token</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-medium">Token</label>
                <button
                  type="button"
                  onClick={() => setShowBearerToken(!showBearerToken)}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  {showBearerToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showBearerToken ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              <input
                type={showBearerToken ? 'text' : 'password'}
                value={auth.bearer?.token || ''}
                onChange={(e) =>
                  updateActiveRequest({
                    auth: {
                      ...auth,
                      bearer: { ...(auth.bearer || { prefix: 'Bearer' }), token: e.target.value },
                    },
                  })
                }
                placeholder="Paste JWT / Bearer token or use {{auth_token}}..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-slate-400 font-medium">Header Prefix:</label>
              <input
                type="text"
                value={auth.bearer?.prefix || 'Bearer'}
                onChange={(e) =>
                  updateActiveRequest({
                    auth: {
                      ...auth,
                      bearer: { ...(auth.bearer || { token: '' }), prefix: e.target.value },
                    },
                  })
                }
                className="w-28 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-300">Header Format: </span>
              Injected into request as{' '}
              <code className="text-cyan-300 font-mono">
                Authorization: {auth.bearer?.prefix || 'Bearer'} &lt;token&gt;
              </code>
            </div>
          </div>
        )}

        {auth.type === 'jwt' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <Key className="w-4 h-4" />
                <span>JWT Bearer Signing</span>
              </div>
              <button
                type="button"
                onClick={handleGenerateJwt}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 text-cyan-300 border border-blue-500/30 hover:bg-blue-600/30 font-medium cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sign &amp; Generate JWT</span>
              </button>
            </div>

            {jwtStatus && (
              <div
                className={`p-2.5 rounded-lg border text-[11px] flex items-center gap-2 ${
                  jwtStatus.type === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {jwtStatus.type === 'ok' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{jwtStatus.msg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Algorithm</label>
                <select
                  value={auth.jwt?.algorithm || 'HS256'}
                  onChange={(e) => updateJwt({ algorithm: e.target.value as JwtBearerAuth['algorithm'] })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="HS256">HS256</option>
                  <option value="HS384">HS384</option>
                  <option value="HS512">HS512</option>
                  <option value="RS256">RS256 (Pre-signed)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Attach Location</label>
                <select
                  value={auth.jwt?.addTo || 'header'}
                  onChange={(e) => updateJwt({ addTo: e.target.value as 'header' | 'query' })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="header">Authorization Header</option>
                  <option value="query">Query Parameter</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">TTL (Seconds)</label>
                <input
                  type="number"
                  value={auth.jwt?.expiresInSeconds ?? 3600}
                  onChange={(e) => updateJwt({ expiresInSeconds: Number(e.target.value) || 3600 })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 font-medium">Signing Secret</label>
                <button
                  type="button"
                  onClick={() => setShowJwtSecret(!showJwtSecret)}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  {showJwtSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showJwtSecret ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showJwtSecret ? 'text' : 'password'}
                value={auth.jwt?.secretOrPrivateKey || ''}
                onChange={(e) => updateJwt({ secretOrPrivateKey: e.target.value })}
                placeholder="HMAC secret key or {{jwt_secret}}"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Payload JSON Claims</label>
              <textarea
                rows={4}
                value={auth.jwt?.payloadJson || ''}
                onChange={(e) => updateJwt({ payloadJson: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-[11px] focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Generated / Active JWT</label>
              <input
                type="text"
                value={auth.jwt?.generatedToken || ''}
                onChange={(e) => updateJwt({ generatedToken: e.target.value })}
                placeholder="Click 'Sign & Generate JWT' or paste a token..."
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-[11px] focus:outline-none"
              />
            </div>
          </div>
        )}

        {auth.type === 'apikey' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <Key className="w-4 h-4" />
                <span>API Key Configuration</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-xs">
                <input
                  type="checkbox"
                  checked={auth.apikey?.enabled ?? true}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        apikey: { ...(auth.apikey || { key: 'X-API-Key', value: '', addTo: 'header' }), enabled: e.target.checked },
                      },
                    })
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900"
                />
                <span>Active</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Key Name</label>
                <input
                  type="text"
                  value={auth.apikey?.key || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        apikey: { ...(auth.apikey || { value: '', addTo: 'header', enabled: true }), key: e.target.value },
                      },
                    })
                  }
                  placeholder="X-API-Key, api_key, etc."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Key Value</label>
                <input
                  type="text"
                  value={auth.apikey?.value || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        apikey: { ...(auth.apikey || { key: 'X-API-Key', addTo: 'header', enabled: true }), value: e.target.value },
                      },
                    })
                  }
                  placeholder="Secret key or {{api_key}}"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Add To Location</label>
              <select
                value={auth.apikey?.addTo || 'header'}
                onChange={(e) =>
                  updateActiveRequest({
                    auth: {
                      ...auth,
                      apikey: {
                        ...(auth.apikey || { key: 'X-API-Key', value: '', enabled: true }),
                        addTo: e.target.value as 'header' | 'query',
                      },
                    },
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
              >
                <option value="header">Request Header</option>
                <option value="query">Query Parameters</option>
              </select>
            </div>
          </div>
        )}

        {auth.type === 'basic' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-medium">
              <Lock className="w-4 h-4" />
              <span>HTTP Basic Authentication</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={auth.basic?.username || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        basic: { ...(auth.basic || { password: '', visible: false }), username: e.target.value },
                      },
                    })
                  }
                  placeholder="username or {{user}}"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowBasicPassword(!showBasicPassword)}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    {showBasicPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showBasicPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showBasicPassword ? 'text' : 'password'}
                  value={auth.basic?.password || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        basic: { ...(auth.basic || { username: '', visible: false }), password: e.target.value },
                      },
                    })
                  }
                  placeholder="••••••••••••"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
              Credentials are base64-encoded into{' '}
              <code className="text-cyan-300 font-mono">Authorization: Basic &lt;credentials&gt;</code>.
            </div>
          </div>
        )}

        {auth.type === 'oauth2' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <Layers className="w-4 h-4" />
                <span>OAuth 2.0 Credentials Manager</span>
              </div>
              <div className="flex items-center gap-2">
                {auth.oauth2?.accessToken && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                      oauthExpired
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {oauthExpired ? 'Token Expired' : 'Token Active'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleGeneratePkce}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate PKCE &amp; State</span>
                </button>
              </div>
            </div>

            {oauthStatus && (
              <div
                className={`p-2.5 rounded-lg border text-[11px] flex items-center gap-2 ${
                  oauthStatus.type === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {oauthStatus.type === 'ok' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{oauthStatus.msg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Grant Type</label>
                <select
                  value={auth.oauth2?.grantType || 'authorization_code'}
                  onChange={(e) => updateOAuth2({ grantType: e.target.value as OAuth2GrantType })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="authorization_code">Authorization Code</option>
                  <option value="authorization_code_pkce">Authorization Code with PKCE (S256)</option>
                  <option value="client_credentials">Client Credentials</option>
                  <option value="refresh_token">Refresh Token</option>
                  <option value="password">Password (Legacy)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Authorization URL</label>
                <input
                  type="text"
                  value={auth.oauth2?.authUrl || ''}
                  onChange={(e) => updateOAuth2({ authUrl: e.target.value })}
                  placeholder="https://oauth.provider.com/authorize"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Access Token URL</label>
                <input
                  type="text"
                  value={auth.oauth2?.accessTokenUrl || ''}
                  onChange={(e) => updateOAuth2({ accessTokenUrl: e.target.value })}
                  placeholder="https://oauth.provider.com/token"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Callback / Redirect URI</label>
                <input
                  type="text"
                  value={auth.oauth2?.redirectUri || ''}
                  onChange={(e) => updateOAuth2({ redirectUri: e.target.value })}
                  placeholder="https://localhost:3000/oauth/callback"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Client ID</label>
                <input
                  type="text"
                  value={auth.oauth2?.clientId || ''}
                  onChange={(e) => updateOAuth2({ clientId: e.target.value })}
                  placeholder="Client ID or {{client_id}}"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-medium">Client Secret</label>
                  <button
                    type="button"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    {showClientSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showClientSecret ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showClientSecret ? 'text' : 'password'}
                  value={auth.oauth2?.clientSecret || ''}
                  onChange={(e) => updateOAuth2({ clientSecret: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Scope</label>
                <input
                  type="text"
                  value={auth.oauth2?.scope || ''}
                  onChange={(e) => updateOAuth2({ scope: e.target.value })}
                  placeholder="read write email profile"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Client Authentication Method</label>
                <select
                  value={auth.oauth2?.clientAuthMethod || 'header'}
                  onChange={(e) => updateOAuth2({ clientAuthMethod: e.target.value as 'header' | 'body' })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="header">Send as Basic Auth header</option>
                  <option value="body">Send client credentials in body</option>
                </select>
              </div>
            </div>

            {auth.oauth2?.grantType === 'authorization_code_pkce' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">PKCE Code Challenge (S256)</label>
                  <input
                    type="text"
                    readOnly
                    value={auth.oauth2?.pkceChallenge || ''}
                    placeholder="Click Generate PKCE & State"
                    className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">CSRF State Token</label>
                  <input
                    type="text"
                    value={auth.oauth2?.state || ''}
                    onChange={(e) => updateOAuth2({ state: e.target.value })}
                    placeholder="CSRF state"
                    className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]"
                  />
                </div>
              </div>
            )}

            {(auth.oauth2?.grantType === 'authorization_code' ||
              auth.oauth2?.grantType === 'authorization_code_pkce') && (
              <div>
                <label className="block text-slate-400 font-medium mb-1">Authorization Code (Callback Code)</label>
                <input
                  type="text"
                  value={auth.oauth2?.authorizationCode || ''}
                  onChange={(e) => updateOAuth2({ authorizationCode: e.target.value })}
                  placeholder="Paste code returned to redirect URI..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Current Access Token</label>
                <input
                  type="text"
                  value={auth.oauth2?.accessToken || auth.oauth2?.token || ''}
                  onChange={(e) => updateOAuth2({ accessToken: e.target.value, token: e.target.value })}
                  placeholder="Acquired Bearer token..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-[11px] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Refresh Token</label>
                <input
                  type="text"
                  value={auth.oauth2?.refreshToken || ''}
                  onChange={(e) => updateOAuth2({ refreshToken: e.target.value })}
                  placeholder="Optional refresh_token..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[11px] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={oauthLoading}
                onClick={() => handleFetchOAuthToken()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{oauthLoading ? 'Requesting Token...' : 'Get New Access Token'}</span>
              </button>

              {auth.oauth2?.refreshToken && (
                <button
                  type="button"
                  disabled={oauthLoading}
                  onClick={() => handleFetchOAuthToken('refresh_token')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Token</span>
                </button>
              )}

              {auth.oauth2?.authUrl && (
                <button
                  type="button"
                  onClick={handleCopyAuthUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Authorize URL</span>
                </button>
              )}
            </div>
          </div>
        )}

        {auth.type === 'mtls' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Mutual TLS (Client Certificate Auth)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-cyan-300 border border-blue-500/20 font-mono">
                Native Desktop TLS Engine
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
              Mutual TLS client certificates are applied directly by the native Rust reqwest TLS engine in the Tauri desktop app. Standard browser sandboxes cannot present custom mTLS PEM private keys.
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Client Certificate (PEM)</label>
              <textarea
                rows={3}
                value={auth.mtls?.clientCertPem || ''}
                onChange={(e) => updateMtls({ clientCertPem: e.target.value })}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-[11px] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Client Private Key (PEM)</label>
              <textarea
                rows={3}
                value={auth.mtls?.clientKeyPem || ''}
                onChange={(e) => updateMtls({ clientKeyPem: e.target.value })}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[11px] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Custom CA Root Certificate (Optional PEM)</label>
              <textarea
                rows={2}
                value={auth.mtls?.caCertPem || ''}
                onChange={(e) => updateMtls({ caCertPem: e.target.value })}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[11px] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

