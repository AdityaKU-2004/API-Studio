/**
 * Security utility for HTML response previewing in a sandboxed iframe.
 *
 * Strict Security Rules:
 * 1. Never use dangerouslySetInnerHTML on the host application DOM.
 * 2. Host inside an iframe with sandbox="" (no allow-scripts, no allow-same-origin, no allow-popups).
 * 3. Wrap with a Content Security Policy inside the document if appropriate to disable external script loading.
 */

export function buildSafePreviewDoc(htmlContent: string): string {
  // If the content is an entire HTML document, inject a restrictive meta CSP right after <head> or at start
  const cspMeta =
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: https: http:; font-src data: https:; media-src data: https: http:; script-src \'none\';">';

  if (htmlContent.includes('<head>')) {
    return htmlContent.replace('<head>', `<head>${cspMeta}`);
  }

  if (htmlContent.toLowerCase().includes('<!doctype html') || htmlContent.toLowerCase().includes('<html')) {
    return `<head>${cspMeta}</head>${htmlContent}`;
  }

  // Fragment
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${cspMeta}
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
}
