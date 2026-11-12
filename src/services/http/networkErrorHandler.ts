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

    // 4. Fetch TypeError (CORS, DNS failure, Connection Refused, or Network Offline)
    if (error instanceof TypeError && msg.includes('failed to fetch')) {
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

      // Check for local IP / localhost vs cross-origin
      const isLocal =
        url.includes('localhost') ||
        url.includes('127.0.0.1') ||
        url.includes('0.0.0.0') ||
        url.includes('192.168.');

      return {
        type: 'cors',
        message: 'CORS restriction or network connection failure',
        details:
          'The browser blocked access to this response because of cross-origin security restrictions (CORS), or the server is unreachable.',
        troubleshooting: [
          'CORS restriction: Modern browsers enforce Same-Origin Policy. The remote server must respond with "Access-Control-Allow-Origin: *" or allow this applet origin.',
          isLocal
            ? 'Local Server: Ensure your local server is actively running on the specified port and configured to allow CORS requests.'
            : 'Third-party API: Some external APIs disallow direct browser client access without a server-side proxy.',
          'Note: In Phase 7, desktop execution with Tauri/Rust will bypass browser CORS restrictions completely.',
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
