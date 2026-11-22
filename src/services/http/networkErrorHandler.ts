import { NetworkError } from '../../types';

export function handleNetworkError(
  error: unknown,
  url: string,
  timeoutMs?: number
): NetworkError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name;

    // 1. Abort / User Cancellation
    if (name === 'AbortError' && msg.includes('cancelled')) {
      return {
        type: 'abort',
        message: 'Request was cancelled by user',
        details: 'The active request was manually aborted before completion.',
      };
    }

    // 2. Timeout
    if (name === 'TimeoutError' || (name === 'AbortError' && msg.includes('timeout'))) {
      return {
        type: 'timeout',
        message: `Request timed out after ${timeoutMs ? timeoutMs + 'ms' : 'the configured duration'}`,
        details:
          'The server took longer to respond than the configured request timeout threshold.',
        troubleshooting: [
          'Increase the request timeout in the Settings tab (Settings -> Request Timeout).',
          'Check if the remote server is experiencing high latency or downtime.',
          'Verify your local network connection.',
        ],
      };
    }

    // 3. Invalid URL
    if (
      msg.includes('invalid url') ||
      msg.includes('failed to parse url') ||
      msg.includes('only absolute urls')
    ) {
      return {
        type: 'invalid_url',
        message: 'Invalid request URL format',
        details: `Could not parse "${url}". Ensure the URL includes a valid protocol (e.g. https://).`,
        troubleshooting: [
          'Verify the URL starts with "http://" or "https://".',
          'Ensure all template variables (e.g. {{base_url}}) are defined in the active environment.',
        ],
      };
    }

    // 4. Fetch TypeError (CORS, DNS failure, Connection Refused, TLS failure, or Network Offline)
    if (error instanceof TypeError && (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed'))) {
      // Check if browser is offline
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {
          type: 'dns_or_network',
          message: 'Network offline: No internet connection detected',
          details: 'Your browser is currently offline. Please reconnect and retry.',
          troubleshooting: [
            'Check your network / Wi-Fi connection.',
            'Ensure your system is connected to the internet.',
          ],
        };
      }

      const isLocal =
        url.includes('localhost') ||
        url.includes('127.0.0.1') ||
        url.includes('0.0.0.0') ||
        url.includes('192.168.');

      let isCrossOrigin = !isLocal;
      try {
        if (typeof window !== 'undefined' && window.location?.origin) {
          isCrossOrigin = new URL(url).origin !== window.location.origin;
        }
      } catch {
        // ignore
      }

      return {
        type: isCrossOrigin ? 'cors' : 'dns_or_network',
        message: isCrossOrigin
          ? 'Network request failed (possible CORS policy, unreachable host, or TLS error)'
          : 'Network request failed (server unreachable, connection refused, or DNS error)',
        details: isCrossOrigin
          ? 'The browser Fetch API threw a generic TypeError — commonly caused by cross-origin security restrictions (CORS), an unreachable host, or a TLS/DNS failure without exposing low-level socket codes.'
          : 'The browser Fetch API threw a generic TypeError without exposing low-level socket or CORS failure codes.',
        troubleshooting: [
          ...(isCrossOrigin
            ? [
                'Possible CORS restriction: Remote servers must include "Access-Control-Allow-Origin" allowing this origin when called from a browser.',
              ]
            : []),
          isLocal
            ? 'Local Server: Confirm the service is running on the target host and port.'
            : 'Connectivity & DNS: Verify the hostname resolves, the server is reachable, and HTTPS certificates are valid.',
          'Desktop execution in Phase 7 (Tauri/Rust) will bypass browser CORS policies and expose exact socket errors.',
        ],
      };
    }

    // Generic error
    return {
      type: 'unknown',
      message: error.message || 'Network request failed',
      details: error.stack,
      troubleshooting: [
        'Check browser developer console for more granular network diagnostics.',
        'Verify target URL and request payload parameters.',
      ],
    };
  }

  return {
    type: 'unknown',
    message: String(error) || 'An unexpected error occurred during HTTP execution',
  };
}
