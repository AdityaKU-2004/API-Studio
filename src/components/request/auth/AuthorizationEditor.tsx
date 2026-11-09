import React, { useState } from 'react';
import { AuthType, OAuth2GrantType } from '../../../types';
import { useRequestStore } from '../../../stores/requestStore';
import { useAuthStore } from '../../../stores/authStore';
import { Key, Shield, Lock, Layers, Eye, EyeOff, RotateCcw, AlertCircle, Info } from 'lucide-react';

export const AuthorizationEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();
  const { resolveEffectiveAuth } = useAuthStore();

  const [showBearerToken, setShowBearerToken] = useState(false);
  const [showBasicPassword, setShowBasicPassword] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const auth = request.auth || { type: 'none' };

  // Calculate inherited / effective authentication
  const effectiveInfo = resolveEffectiveAuth(auth, request.collectionId, request.folderId);

  const handleTypeChange = (type: AuthType) => {
    updateActiveRequest({
      auth: {
        ...auth,
        type,
        apikey: auth.apikey || { key: 'X-API-Key', value: '', addTo: 'header', enabled: true },
        bearer: auth.bearer || { token: '', prefix: 'Bearer', visible: false },
        basic: auth.basic || { username: '', password: '', visible: false },
        oauth2: auth.oauth2 || {
          grantType: 'authorization_code',
          authUrl: '',
          accessTokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: '',
          redirectUri: 'https://oauth.pstmn.io/v1/browser-callback',
          state: '',
          clientAuthMethod: 'header',
        },
      },
    });
  };

  return (
    <div className="p-4 space-y-5 text-xs select-none max-w-3xl">
      {/* Type Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h4 className="text-xs font-semibold text-slate-200">Authentication Protocol</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Configure authentication credentials or inherit from parent collection/folder.
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
          <option value="apikey">API Key</option>
          <option value="basic">Basic Auth</option>
          <option value="oauth2">OAuth 2.0</option>
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

              <div className="relative">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <Layers className="w-4 h-4" />
                <span>OAuth 2.0 Credentials Manager</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-cyan-300 border border-blue-500/20 font-mono">
                Phase 2 Configuration Only
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Grant Type</label>
                <select
                  value={auth.oauth2?.grantType || 'authorization_code'}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        oauth2: {
                          ...(auth.oauth2 || {
                            authUrl: '',
                            accessTokenUrl: '',
                            clientId: '',
                            clientSecret: '',
                            scope: '',
                            redirectUri: '',
                            clientAuthMethod: 'header',
                          }),
                          grantType: e.target.value as OAuth2GrantType,
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="authorization_code">Authorization Code</option>
                  <option value="authorization_code_pkce">Authorization Code with PKCE</option>
                  <option value="client_credentials">Client Credentials</option>
                  <option value="password">Password (Legacy)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Access Token URL</label>
                <input
                  type="text"
                  value={auth.oauth2?.accessTokenUrl || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        oauth2: {
                          ...(auth.oauth2 || {
                            grantType: 'authorization_code',
                            authUrl: '',
                            clientId: '',
                            clientSecret: '',
                            scope: '',
                            redirectUri: '',
                            clientAuthMethod: 'header',
                          }),
                          accessTokenUrl: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="https://oauth.provider.com/token"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Client ID</label>
                <input
                  type="text"
                  value={auth.oauth2?.clientId || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        oauth2: {
                          ...(auth.oauth2 || {
                            grantType: 'authorization_code',
                            authUrl: '',
                            accessTokenUrl: '',
                            clientSecret: '',
                            scope: '',
                            redirectUri: '',
                            clientAuthMethod: 'header',
                          }),
                          clientId: e.target.value,
                        },
                      },
                    })
                  }
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
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        oauth2: {
                          ...(auth.oauth2 || {
                            grantType: 'authorization_code',
                            authUrl: '',
                            accessTokenUrl: '',
                            clientId: '',
                            scope: '',
                            redirectUri: '',
                            clientAuthMethod: 'header',
                          }),
                          clientSecret: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="••••••••••••"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Scope</label>
                <input
                  type="text"
                  value={auth.oauth2?.scope || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        oauth2: {
                          ...(auth.oauth2 || {
                            grantType: 'authorization_code',
                            authUrl: '',
                            accessTokenUrl: '',
                            clientId: '',
                            clientSecret: '',
                            redirectUri: '',
                            clientAuthMethod: 'header',
                          }),
                          scope: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="read write email profile"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Client Authentication Method</label>
                <select
                  value={auth.oauth2?.clientAuthMethod || 'header'}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        oauth2: {
                          ...(auth.oauth2 || {
                            grantType: 'authorization_code',
                            authUrl: '',
                            accessTokenUrl: '',
                            clientId: '',
                            clientSecret: '',
                            scope: '',
                            redirectUri: '',
                          }),
                          clientAuthMethod: e.target.value as 'header' | 'body',
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="header">Send as Basic Auth header</option>
                  <option value="body">Send client credentials in body</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
