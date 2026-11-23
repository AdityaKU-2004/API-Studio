import React from 'react';
import { useRequestStore } from '../../../stores/requestStore';
import { RequestSettings as IRequestSettings } from '../../../types';
import {
  ShieldCheck,
  ShieldAlert,
  Wifi,
  Cpu,
  SlidersHorizontal,
  Info,
  Globe,
} from 'lucide-react';

export const RequestSettings: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const settings: IRequestSettings = request.settings || {
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
  };

  const updateSetting = <K extends keyof IRequestSettings>(key: K, value: IRequestSettings[K]) => {
    updateActiveRequest({
      settings: {
        ...settings,
        [key]: value,
      },
    });
  };

  const isInsecureTls = !settings.sslVerification || Boolean(settings.allowInsecureCertificates);

  return (
    <div className="p-4 space-y-6 max-w-2xl text-xs select-none">
      {/* Notice header */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-slate-300">
        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
        <p className="text-[11px] leading-relaxed">
          Settings are saved per request. TLS overrides, custom CA certificates, and per-request proxy
          configurations are enforced natively when running in API Studio Desktop.
        </p>
      </div>

      {/* 1. General Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          General
        </h4>

        <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/40">
          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Request Timeout</div>
              <div className="text-[11px] text-slate-500">
                Cancel request if no response received within specified milliseconds
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="500"
                min="0"
                value={settings.timeout}
                onChange={(e) => updateSetting('timeout', Number(e.target.value) || 5000)}
                className="w-24 px-2 py-1 text-right rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
              />
              <span className="text-slate-500 font-mono">ms</span>
            </div>
          </div>

          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Follow HTTP Redirects</div>
              <div className="text-[11px] text-slate-500">
                Automatically follow 3xx location redirect responses
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.followRedirects}
                onChange={(e) => updateSetting('followRedirects', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Maximum Redirects</div>
              <div className="text-[11px] text-slate-500">
                Maximum number of redirects to follow before aborting
              </div>
            </div>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.maxRedirects || 5}
              onChange={(e) => updateSetting('maxRedirects', Number(e.target.value) || 5)}
              className="w-20 px-2 py-1 text-right rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Automatically Encode URL</div>
              <div className="text-[11px] text-slate-500">
                Encode reserved URI characters in query parameters and paths
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoEncodeUrl}
                onChange={(e) => updateSetting('autoEncodeUrl', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>
        </div>
      </div>

      {/* 2. Security & TLS Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Security & TLS
        </h4>

        {isInsecureTls && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-amber-100">Security Warning:</strong> Certificate verification
              is disabled for this request. Only disable TLS verification for trusted local development
              servers.
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/40">
          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">SSL Certificate Verification</div>
              <div className="text-[11px] text-slate-500">
                Verify TLS/SSL certificate against system root authorities (Recommended)
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.sslVerification}
                onChange={(e) => updateSetting('sslVerification', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Allow Insecure Localhost Certificates</div>
              <div className="text-[11px] text-slate-500">
                Accept self-signed certificates when testing on localhost / 127.0.0.1
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowInsecureCertificates || false}
                onChange={(e) => updateSetting('allowInsecureCertificates', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
            </label>
          </div>

          <div className="p-3 space-y-1.5">
            <div className="font-medium text-slate-200">Custom CA Certificate (PEM, Desktop)</div>
            <textarea
              rows={2}
              value={settings.customCaPem || ''}
              onChange={(e) => updateSetting('customCaPem', e.target.value)}
              placeholder="-----BEGIN CERTIFICATE----- ..."
              className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* 3. Per-Request Proxy Override (Desktop) */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          Per-Request Proxy Override (Desktop)
        </h4>

        <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/40">
          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Override Global Proxy</div>
              <div className="text-[11px] text-slate-500">
                Route only this request through a dedicated HTTP/HTTPS/SOCKS5 proxy
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.proxy?.enabled)}
                onChange={(e) =>
                  updateSetting('proxy', {
                    enabled: e.target.checked,
                    protocol: settings.proxy?.protocol || 'http',
                    host: settings.proxy?.host || '127.0.0.1',
                    port: settings.proxy?.port || 8888,
                    username: settings.proxy?.username || '',
                    password: settings.proxy?.password || '',
                    bypassList: settings.proxy?.bypassList || [],
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          {settings.proxy?.enabled && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={settings.proxy.protocol}
                onChange={(e) =>
                  updateSetting('proxy', {
                    ...settings.proxy!,
                    protocol: e.target.value as 'http' | 'https' | 'socks5',
                  })
                }
                className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
              <input
                type="text"
                value={settings.proxy.host}
                onChange={(e) =>
                  updateSetting('proxy', { ...settings.proxy!, host: e.target.value })
                }
                placeholder="proxy.host"
                className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono"
              />
              <input
                type="number"
                value={settings.proxy.port}
                onChange={(e) =>
                  updateSetting('proxy', {
                    ...settings.proxy!,
                    port: Number(e.target.value) || 8888,
                  })
                }
                placeholder="8888"
                className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Connection & Protocol */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-blue-400" />
          Connection
        </h4>

        <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/40">
          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">HTTP Protocol Version</div>
              <div className="text-[11px] text-slate-500">
                Select specific protocol or let client negotiate via ALPN
              </div>
            </div>
            <select
              value={settings.httpVersion || 'auto'}
              onChange={(e) => updateSetting('httpVersion', e.target.value as any)}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="auto">Auto Negotiate</option>
              <option value="http1.1">HTTP/1.1</option>
              <option value="http2">HTTP/2</option>
            </select>
          </div>

          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Keep-Alive Connections</div>
              <div className="text-[11px] text-slate-500">
                Reuse persistent TCP connections across requests
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.keepAlive ?? true}
                onChange={(e) => updateSetting('keepAlive', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>
        </div>
      </div>

      {/* 5. Advanced Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          Advanced
        </h4>

        <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/40">
          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Disable Client Cache</div>
              <div className="text-[11px] text-slate-500">
                Send Cache-Control: no-cache and ignore local cached responses
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.disableCache || false}
                onChange={(e) => updateSetting('disableCache', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          <div className="p-3 space-y-1.5">
            <div className="font-medium text-slate-200">Custom User-Agent Header</div>
            <input
              type="text"
              value={settings.customUserAgent || ''}
              onChange={(e) => updateSetting('customUserAgent', e.target.value)}
              placeholder="API Studio/2.0"
              className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
