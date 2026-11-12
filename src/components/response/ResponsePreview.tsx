import React, { useMemo } from 'react';
import { Download, ExternalLink, Image as ImageIcon, FileText, Music, Video, ShieldCheck } from 'lucide-react';
import { ApiResponse } from '../../types';
import { buildSafePreviewDoc } from '../../utils/safeHtmlPreview';
import { formatBytes } from '../../utils/formatBytes';

interface ResponsePreviewProps {
  response: ApiResponse;
}

export const ResponsePreview: React.FC<ResponsePreviewProps> = ({ response }) => {
  const category = response.contentTypeCategory;

  const safeHtmlDoc = useMemo(() => {
    if (category === 'html') {
      return buildSafePreviewDoc(response.body);
    }
    return '';
  }, [category, response.body]);

  const handleDownload = () => {
    let blob: Blob;
    if (response.binaryDataUrl) {
      // Direct anchor click from object URL
      const a = document.createElement('a');
      a.href = response.binaryDataUrl;
      a.download = `response_${Date.now()}`;
      a.click();
      return;
    } else {
      blob = new Blob([response.body], { type: response.contentType });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${response.status}_${Date.now()}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 1. HTML preview
  if (category === 'html') {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-white">
        <div className="flex items-center justify-between px-3 py-1 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-medium">Sandboxed HTML Preview (Scripts & Network Disabled)</span>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Download HTML</span>
          </button>
        </div>
        <iframe
          title="Response HTML Preview"
          srcDoc={safeHtmlDoc}
          sandbox=""
          className="flex-1 w-full h-full border-none bg-white"
        />
      </div>
    );
  }

  // 2. Image preview
  if (category === 'image' && response.binaryDataUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-4 overflow-auto">
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl max-w-xl max-h-[80%] flex flex-col items-center">
          <img
            src={response.binaryDataUrl}
            alt="Response preview"
            className="max-h-[350px] max-w-full rounded-lg object-contain bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:16px_16px]"
          />
          <div className="flex items-center justify-between w-full mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono">{response.contentType}</span>
              <span>•</span>
              <span className="font-mono">{formatBytes(response.size)}</span>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Image</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Audio / Video
  if (category === 'audio' && response.binaryDataUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl max-w-md w-full space-y-4 text-center">
          <Music className="w-10 h-10 text-cyan-400 mx-auto" />
          <div className="text-xs font-mono text-slate-300">{response.contentType}</div>
          <audio controls src={response.binaryDataUrl} className="w-full" />
          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer mx-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Audio</span>
          </button>
        </div>
      </div>
    );
  }

  if (category === 'video' && response.binaryDataUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl max-w-xl w-full space-y-3">
          <video controls src={response.binaryDataUrl} className="w-full rounded-lg max-h-[360px]" />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">{response.contentType}</span>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Video</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Default / Fallback preview
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 select-none">
      <div className="p-4 rounded-full bg-slate-800/80 text-cyan-400">
        <FileText className="w-10 h-10" />
      </div>
      <div className="space-y-1 max-w-md">
        <h4 className="text-sm font-semibold text-slate-200">
          Visual Preview for {response.contentTypeCategory.toUpperCase()}
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          {category === 'json'
            ? 'For JSON data, switch to the "Pretty" tab for formatted syntax inspection or "Raw" for byte inspection.'
            : `Preview rendering is not natively supported for MIME type "${response.contentType}". You can download the payload or inspect the raw representation.`}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleDownload}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Response ({formatBytes(response.size)})</span>
        </button>
      </div>
    </div>
  );
};
