import React from 'react';
import { ApiResponse } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';
import { ResponsePrettyView } from './ResponsePrettyView';
import { ResponseRawView } from './ResponseRawView';
import { ResponsePreview } from './ResponsePreview';
import { ResponseError } from './ResponseError';
import { JsonTreeViewer } from '../response-analysis/JsonTreeViewer';
import { JsonPathExplorer } from '../response-analysis/JsonPathExplorer';

interface ResponseBodyProps {
  response: ApiResponse;
}

export const ResponseBody: React.FC<ResponseBodyProps> = ({ response }) => {
  const { responseBodyFormat, setResponseBodyFormat } = useUiStore();
  const { tabs, activeTabId } = useRequestStore();
  const activeRequest = tabs.find((t) => t.id === activeTabId)?.request;

  // If request failed with network error, show rich error view
  if (response.status === 0 && response.error) {
    return <ResponseError error={response.error} url={response.url} request={activeRequest} response={response} />;
  }

  return (
    <div className="flex flex-col h-full select-none">
      {/* Sub-format toggles: Pretty / Raw / Tree / JSONPath / Preview */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/40 text-[11px] shrink-0">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'pretty', label: 'Pretty' },
              { id: 'raw', label: 'Raw' },
              { id: 'tree', label: 'Tree' },
              { id: 'jsonpath', label: 'JSONPath' },
              { id: 'preview', label: 'Preview' },
            ] as const
          ).map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setResponseBodyFormat(fmt.id)}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                responseBodyFormat === fmt.id
                  ? 'bg-blue-600/30 text-cyan-300 font-semibold border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {fmt.label}
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
        {responseBodyFormat === 'tree' && (
          <JsonTreeViewer data={response.parsedBody} rawText={response.body} />
        )}
        {responseBodyFormat === 'jsonpath' && <JsonPathExplorer rawJsonText={response.body} />}
        {responseBodyFormat === 'preview' && <ResponsePreview response={response} />}
      </div>
    </div>
  );
};
