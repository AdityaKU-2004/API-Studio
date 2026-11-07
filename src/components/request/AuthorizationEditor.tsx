import React from 'react';
import { AuthType } from '../../types';
import { useRequestStore } from '../../stores/requestStore';
import { Key, Shield, Lock, Layers } from 'lucide-react';

export const AuthorizationEditor: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const auth = request.auth || { type: 'none' };

  const handleTypeChange = (type: AuthType) => {
    updateActiveRequest({
      auth: {
        ...auth,
        type,
        bearer: auth.bearer || { token: '', prefix: 'Bearer' },
        apikey: auth.apikey || { key: 'X-API-Key', value: '', addTo: 'header' },
        basic: auth.basic || { username: '', password: '' },
        oauth2: auth.oauth2 || {
          grantType: 'client_credentials',
          authUrl: '',
          accessTokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: '',
        },
      },
    });
  };

  return (
    <div className="p-4 space-y-5 text-xs select-none max-w-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-200">Authentication Type</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Select authentication scheme to inject credentials into request headers or parameters.
          </p>
        </div>

        <select
          value={auth.type}
          onChange={(e) => handleTypeChange(e.target.value as AuthType)}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-medium focus:outline-none focus:border-cyan-400 cursor-pointer"
        >
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="apikey">API Key</option>
          <option value="basic">Basic Auth</option>
          <option value="oauth2">OAuth 2.0</option>
        </select>
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
        {auth.type === 'none' && (
          <div className="py-6 text-center text-slate-500 space-y-1">
            <Shield className="w-8 h-8 mx-auto text-slate-600 stroke-1" />
            <p>This request does not use any authorization headers.</p>
          </div>
        )}

        {auth.type === 'bearer' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-medium">
              <Key className="w-4 h-4" />
              <span>Bearer Token Authentication</span>
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Token</label>
              <textarea
                rows={3}
                value={auth.bearer?.token || ''}
                onChange={(e) =>
                  updateActiveRequest({
                    auth: {
                      ...auth,
                      bearer: { ...(auth.bearer || { prefix: 'Bearer' }), token: e.target.value },
                    },
                  })
                }
                placeholder="Paste JWT or bearer token, or use {{auth_token}}..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-400 resize-none"
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
                className="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
              />
            </div>
          </div>
        )}

        {auth.type === 'apikey' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-medium">
              <Key className="w-4 h-4" />
              <span>API Key Authentication</span>
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
                        apikey: { ...(auth.apikey || { value: '', addTo: 'header' }), key: e.target.value },
                      },
                    })
                  }
                  placeholder="X-API-Key or api_key"
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
                        apikey: { ...(auth.apikey || { key: 'X-API-Key', addTo: 'header' }), value: e.target.value },
                      },
                    })
                  }
                  placeholder="Value or {{api_key}}"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Add To</label>
              <select
                value={auth.apikey?.addTo || 'header'}
                onChange={(e) =>
                  updateActiveRequest({
                    auth: {
                      ...auth,
                      apikey: {
                        ...(auth.apikey || { key: 'X-API-Key', value: '' }),
                        addTo: e.target.value as 'header' | 'query',
                      },
                    },
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
              >
                <option value="header">Header</option>
                <option value="query">Query Params</option>
              </select>
            </div>
          </div>
        )}

        {auth.type === 'basic' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-medium">
              <Lock className="w-4 h-4" />
              <span>Basic Authentication</span>
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
                        basic: { ...(auth.basic || { password: '' }), username: e.target.value },
                      },
                    })
                  }
                  placeholder="Username"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={auth.basic?.password || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        basic: { ...(auth.basic || { username: '' }), password: e.target.value },
                      },
                    })
                  }
                  placeholder="Password"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {auth.type === 'oauth2' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-medium">
              <Layers className="w-4 h-4" />
              <span>OAuth 2.0 Credentials</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Grant Type</label>
                <select
                  value={auth.oauth2?.grantType || 'client_credentials'}
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
                          }),
                          grantType: e.target.value as any,
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="client_credentials">Client Credentials</option>
                  <option value="authorization_code">Authorization Code</option>
                  <option value="implicit">Implicit</option>
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
                            grantType: 'client_credentials',
                            authUrl: '',
                            clientId: '',
                            clientSecret: '',
                            scope: '',
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
                            grantType: 'client_credentials',
                            authUrl: '',
                            accessTokenUrl: '',
                            clientSecret: '',
                            scope: '',
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
                <label className="block text-slate-400 font-medium mb-1">Client Secret</label>
                <input
                  type="password"
                  value={auth.oauth2?.clientSecret || ''}
                  onChange={(e) =>
                    updateActiveRequest({
                      auth: {
                        ...auth,
                        oauth2: {
                          ...(auth.oauth2 || {
                            grantType: 'client_credentials',
                            authUrl: '',
                            accessTokenUrl: '',
                            clientId: '',
                            scope: '',
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
