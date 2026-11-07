import React from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { ShieldCheck, RotateCcw, Clock, Link2 } from 'lucide-react';

export const RequestSettings: React.FC = () => {
  const { tabs, activeTabId, updateActiveRequest } = useRequestStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  if (!request) return null;

  const settings = request.settings || {
    timeout: 10000,
    followRedirects: true,
    sslVerification: true,
    autoEncodeUrl: true,
  };

  const updateSettings = (key: keyof typeof settings, value: any) => {
    updateActiveRequest({
      settings: {
        ...settings,
        [key]: value,
      },
    });
  };

  return (
    <div className="p-4 space-y-4 max-w-xl text-xs select-none">
      <h4 className="text-xs font-semibold text-slate-200">Request Execution Settings</h4>

      <div className="space-y-3">
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-slate-200">Request Timeout</div>
              <div className="text-[11px] text-slate-500">
                Cancel network request after elapsed milliseconds
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="500"
              value={settings.timeout}
              onChange={(e) => updateSettings('timeout', Number(e.target.value) || 5000)}
              className="w-24 px-2 py-1 text-right rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
            />
            <span className="text-slate-500 font-mono">ms</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <RotateCcw className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-slate-200">Follow HTTP Redirects</div>
              <div className="text-[11px] text-slate-500">
                Automatically follow 3xx location redirect responses
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.followRedirects}
              onChange={(e) => updateSettings('followRedirects', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
          </label>
        </div>

        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-slate-200">SSL Certificate Verification</div>
              <div className="text-[11px] text-slate-500">
                Verify server TLS/SSL certificate authenticity
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sslVerification}
              onChange={(e) => updateSettings('sslVerification', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
          </label>
        </div>

        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Link2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-slate-200">Automatically Encode URL</div>
              <div className="text-[11px] text-slate-500">
                Encode reserved URI characters in query parameters
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoEncodeUrl}
              onChange={(e) => updateSettings('autoEncodeUrl', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
          </label>
        </div>
      </div>
    </div>
  );
};
