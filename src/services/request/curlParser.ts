import { HttpMethod, KeyValueItem, FormDataItem, ApiRequest } from '../../types';
import { parseUrl } from './urlBuilder';

export interface ParsedCurlResult {
  success: boolean;
  error?: string;
  request?: Partial<ApiRequest>;
  rawCommand: string;
}

/**
 * Tokenizes a command line string respecting single, double, and backtick quotes and backslash escapes.
 */
function tokenizeCommand(command: string): string[] {
  // Replace newlines with spaces while keeping string literals safe
  const cleaned = command.replace(/\\\r?\n/g, ' ').trim();
  const tokens: string[] = [];
  let current = '';
  let inQuote: '' | "'" | '"' = '';
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (isEscaped) {
      current += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\' && inQuote !== "'") {
      isEscaped = true;
      continue;
    }

    if (inQuote) {
      if (char === inQuote) {
        inQuote = '';
      } else {
        current += char;
      }
    } else {
      if (char === "'" || char === '"') {
        inQuote = char;
      } else if (/\s/.test(char)) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parses a cURL command into an API Studio request definition.
 */
export function parseCurlCommand(rawCommand: string): ParsedCurlResult {
  try {
    const tokens = tokenizeCommand(rawCommand);
    if (tokens.length === 0 || tokens[0].toLowerCase() !== 'curl') {
      return {
        success: false,
        error: 'Invalid cURL command: must start with "curl"',
        rawCommand,
      };
    }

    let method: HttpMethod = 'GET';
    let url = '';
    const headers: KeyValueItem[] = [];
    const formData: FormDataItem[] = [];
    let rawBody = '';
    let bodyType: ApiRequest['bodyType'] = 'none';
    let hasExplicitMethod = false;
    let authHeader: string | null = null;
    let basicUserPass: string | null = null;

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];

      // Method: -X / --request
      if (token === '-X' || token === '--request') {
        const next = tokens[++i];
        if (next) {
          method = next.toUpperCase() as HttpMethod;
          hasExplicitMethod = true;
        }
      }
      // Header: -H / --header
      else if (token === '-H' || token === '--header') {
        const next = tokens[++i];
        if (next) {
          const colonIdx = next.indexOf(':');
          if (colonIdx !== -1) {
            const hKey = next.substring(0, colonIdx).trim();
            const hVal = next.substring(colonIdx + 1).trim();

            if (hKey.toLowerCase() === 'authorization') {
              authHeader = hVal;
            }

            headers.push({
              id: 'h-' + Math.random().toString(36).substring(2, 9),
              key: hKey,
              value: hVal,
              enabled: true,
            });
          }
        }
      }
      // Data: -d, --data, --data-raw, --data-binary, --data-ascii
      else if (
        token === '-d' ||
        token === '--data' ||
        token === '--data-raw' ||
        token === '--data-binary' ||
        token === '--data-ascii'
      ) {
        const next = tokens[++i];
        if (next !== undefined) {
          rawBody = next;
          if (!hasExplicitMethod) {
            method = 'POST';
          }
        }
      }
      // Form: -F / --form
      else if (token === '-F' || token === '--form') {
        const next = tokens[++i];
        if (next) {
          const eqIdx = next.indexOf('=');
          if (eqIdx !== -1) {
            const fKey = next.substring(0, eqIdx).trim();
            const fVal = next.substring(eqIdx + 1).trim();
            const isFile = fVal.startsWith('@');

            formData.push({
              id: 'fd-' + Math.random().toString(36).substring(2, 9),
              key: fKey,
              value: isFile ? fVal.substring(1) : fVal,
              type: isFile ? 'file' : 'text',
              enabled: true,
            });
          }
          if (!hasExplicitMethod) {
            method = 'POST';
          }
        }
      }
      // Basic User: -u / --user
      else if (token === '-u' || token === '--user') {
        const next = tokens[++i];
        if (next) {
          basicUserPass = next;
        }
      }
      // URL (if not an option)
      else if (!token.startsWith('-') && !url) {
        url = token;
      }
    }

    if (!url) {
      return {
        success: false,
        error: 'No target URL found in the cURL command',
        rawCommand,
      };
    }

    // Determine body type
    if (formData.length > 0) {
      bodyType = 'form-data';
    } else if (rawBody) {
      try {
        JSON.parse(rawBody);
        bodyType = 'json';
      } catch {
        if (rawBody.trim().startsWith('<') && rawBody.trim().endsWith('>')) {
          bodyType = 'xml';
        } else {
          bodyType = 'text';
        }
      }
    }

    // Determine Auth
    const auth: ApiRequest['auth'] = { type: 'none' };
    if (basicUserPass) {
      const [username, password] = basicUserPass.split(':');
      auth.type = 'basic';
      auth.basic = { username: username || '', password: password || '', visible: false };
    } else if (authHeader) {
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        auth.type = 'bearer';
        auth.bearer = { token: authHeader.substring(7).trim(), prefix: 'Bearer', visible: false };
      } else if (authHeader.toLowerCase().startsWith('basic ')) {
        try {
          const decoded = atob(authHeader.substring(6).trim());
          const [u, p] = decoded.split(':');
          auth.type = 'basic';
          auth.basic = { username: u || '', password: p || '', visible: false };
        } catch {
          // Keep as custom header
        }
      }
    }

    // Extract query parameters from URL
    const parsedUrlInfo = parseUrl(url);

    return {
      success: true,
      request: {
        method,
        url,
        params: parsedUrlInfo.params,
        headers: headers.length > 0 ? headers : [{ id: 'h-1', key: 'Accept', value: 'application/json', enabled: true }],
        auth,
        bodyType,
        rawBody,
        formData,
        urlEncoded: [],
      },
      rawCommand,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse cURL command: ${err instanceof Error ? err.message : String(err)}`,
      rawCommand,
    };
  }
}
