import React from 'react';
import { ApiResponse } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { ResponsePrettyView } from './ResponsePrettyView';
import { ResponseRawView } from './ResponseRawView';
import { ResponsePreview } from './ResponsePreview';
import { ResponseError } from './ResponseError';

interface ResponseBodyProps {
  response: ApiResponse;
}

export const ResponseBody: React.FC<ResponseBodyProps> = ({ response }) => {
  const { responseBodyFormat, setResponseBodyFormat } = useUiStore();

  // If request failed with network error, show rich error view
  if (response.status === 0 && response.error) {
    return <ResponseError error={response.error} url={response.url} />;
  }

  return (
    <div className="flex flex-col h-full select-none">
      {/* Sub-format toggles: Pretty / Raw / Preview */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/40 text-[11px] shrink-0">
        <div className="flex items-center gap-1">
          {(['pretty', 'raw', 'preview'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setResponseBodyFormat(fmt)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition-colors cursor-pointer ${
                responseBodyFormat === fmt
                  ? 'bg-blue-600/30 text-cyan-300 font-semibold border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
            {response.contentTypeCategory.toUpperCase()}
          </span>
          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[220px]">
            {response.contentType}
          </span>
        </div>
      </div>

      {/* Body Viewport */}
      <div className="flex-1 min-h-[220px] overflow-hidden">
        {responseBodyFormat === 'pretty' && <ResponsePrettyView response={response} />}
        {responseBodyFormat === 'raw' && <ResponseRawView response={response} />}
        {responseBodyFormat === 'preview' && <ResponsePreview response={response} />}
      </div>
    </div>
  );
};
