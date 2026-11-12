import { describe, it, expect } from 'vitest';
import { handleNetworkError } from '../../services/http/networkErrorHandler';

describe('networkErrorHandler', () => {
  it('1. classifies user cancellation when AbortError occurs with cancelled message', () => {
    const abortErr = new Error('Request was cancelled by user');
    abortErr.name = 'AbortError';

    const classified = handleNetworkError(abortErr, 'https://api.example.com');
    expect(classified.type).toBe('abort');
    expect(classified.message).toContain('cancelled by user');
  });

  it('2. classifies request timeout when TimeoutError occurs', () => {
    const timeoutErr = new Error('Request timed out');
    timeoutErr.name = 'TimeoutError';

    const classified = handleNetworkError(timeoutErr, 'https://api.example.com', 5000);
    expect(classified.type).toBe('timeout');
    expect(classified.message).toContain('timed out after 5000ms');
    expect(classified.troubleshooting).toBeDefined();
    expect(classified.troubleshooting?.length).toBeGreaterThan(0);
  });

  it('3. classifies TypeError "Failed to fetch" as CORS/network restriction with troubleshooting guide', () => {
    const fetchErr = new TypeError('Failed to fetch');

    const classified = handleNetworkError(fetchErr, 'https://api.external.com/data');
    expect(classified.type).toBe('cors');
    expect(classified.details).toContain('cross-origin security restrictions');
    expect(classified.troubleshooting?.[0]).toContain('Access-Control-Allow-Origin');
  });

  it('4. classifies invalid URL syntax', () => {
    const urlErr = new Error('Invalid URL');

    const classified = handleNetworkError(urlErr, 'http://malformed-url');
    expect(classified.type).toBe('invalid_url');
    expect(classified.message).toContain('Invalid request URL format');
  });
});
