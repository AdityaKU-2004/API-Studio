import { ResponseContentTypeCategory } from '../types';

/**
 * Detects content type category from MIME string or content inspection.
 */
export function detectContentTypeCategory(
  contentType: string,
  sampleContent?: string
): ResponseContentTypeCategory {
  const mime = contentType.toLowerCase().split(';')[0].trim();

  if (mime.includes('json') || mime.endsWith('+json')) {
    return 'json';
  }
  if (mime.includes('xml') || mime.endsWith('+xml')) {
    return 'xml';
  }
  if (mime.includes('html')) {
    return 'html';
  }
  if (mime.startsWith('image/')) {
    return 'image';
  }
  if (mime.startsWith('audio/')) {
    return 'audio';
  }
  if (mime.startsWith('video/')) {
    return 'video';
  }
  if (mime === 'application/pdf') {
    return 'pdf';
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/javascript' ||
    mime === 'application/typescript'
  ) {
    return 'text';
  }
  if (
    mime.includes('octet-stream') ||
    mime.includes('binary') ||
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('gzip')
  ) {
    return 'binary';
  }

  // Fallback heuristic based on content start
  if (sampleContent) {
    const trimmed = sampleContent.trimStart();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        JSON.parse(sampleContent);
        return 'json';
      } catch {
        // Not valid json
      }
    }
    if (trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.endsWith('>'))) {
      if (trimmed.toLowerCase().includes('<!doctype html') || trimmed.toLowerCase().includes('<html')) {
        return 'html';
      }
      return 'xml';
    }
  }

  return 'text';
}

/**
 * Pretty-formats content according to its category.
 */
export function formatContent(content: string, category: ResponseContentTypeCategory): string {
  if (!content) return '';

  if (category === 'json') {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  if (category === 'xml' || category === 'html') {
    return formatXmlOrHtml(content);
  }

  return content;
}

/**
 * Minifies JSON content if possible.
 */
export function minifyJson(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed);
  } catch {
    return content;
  }
}

/**
 * Lightweight XML/HTML indenter for visual display without external dependencies.
 */
function formatXmlOrHtml(source: string): string {
  try {
    let formatted = '';
    let indent = 0;
    const tab = '  ';

    // Split on tags
    const tokens = source.split(/(<[^>]+>)/g).filter(Boolean);

    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('</')) {
        // Closing tag
        indent = Math.max(0, indent - 1);
        formatted += '\n' + tab.repeat(indent) + trimmed;
      } else if (trimmed.startsWith('<') && trimmed.endsWith('/>')) {
        // Self-closing tag
        formatted += '\n' + tab.repeat(indent) + trimmed;
      } else if (trimmed.startsWith('<') && !trimmed.startsWith('<!') && !trimmed.startsWith('<?')) {
        // Opening tag
        formatted += '\n' + tab.repeat(indent) + trimmed;
        indent++;
      } else if (trimmed.startsWith('<!') || trimmed.startsWith('<?')) {
        formatted += '\n' + tab.repeat(indent) + trimmed;
      } else {
        // Text node
        formatted += trimmed;
      }
    }

    return formatted.trimStart();
  } catch {
    return source;
  }
}
