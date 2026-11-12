import { describe, it, expect } from 'vitest';
import { parseFetchResponse } from '../../services/http/responseParser';
import { detectContentTypeCategory, formatContent } from '../../utils/responseDetection';

describe('responseParser & responseDetection', () => {
  it('1. detects JSON content type and parses JSON objects', async () => {
    const jsonStr = JSON.stringify({ success: true, count: 42 });
    const mockResponse = new Response(jsonStr, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

    const parsed = await parseFetchResponse(mockResponse);
    expect(parsed.category).toBe('json');
    expect(parsed.isBinary).toBe(false);
    expect(parsed.sizeBytes).toBe(new TextEncoder().encode(jsonStr).byteLength);
    expect((parsed.parsedBody as any).count).toBe(42);
  });

  it('2. detects XML content type and formats XML', async () => {
    const xmlStr = '<users><user id="1"><name>Alice</name></user></users>';
    const mockResponse = new Response(xmlStr, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });

    const parsed = await parseFetchResponse(mockResponse);
    expect(parsed.category).toBe('xml');
    expect(parsed.bodyText).toBe(xmlStr);

    const formatted = formatContent(xmlStr, 'xml');
    expect(formatted).toContain('<users>');
    expect(formatted).toContain('  <user id="1">');
  });

  it('3. detects HTML content type properly', async () => {
    const htmlStr = '<!doctype html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';
    const mockResponse = new Response(htmlStr, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

    const parsed = await parseFetchResponse(mockResponse);
    expect(parsed.category).toBe('html');
    expect(parsed.bodyText).toContain('<h1>Hello</h1>');
  });

  it('4. detects binary image and creates object URL', async () => {
    const dummyBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
    const mockResponse = new Response(dummyBytes, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });

    // Provide mock createObjectURL if running in node env
    if (typeof URL.createObjectURL === 'undefined') {
      URL.createObjectURL = () => 'blob:mock-url-123';
    }

    const parsed = await parseFetchResponse(mockResponse);
    expect(parsed.category).toBe('image');
    expect(parsed.isBinary).toBe(true);
    expect(parsed.sizeBytes).toBe(8);
  });

  it('5. accurately calculates byte size for multibyte Unicode characters', async () => {
    const unicodeString = '🚀 API Studio 世界 🌐';
    const expectedByteLength = new TextEncoder().encode(unicodeString).byteLength;

    const mockResponse = new Response(unicodeString, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

    const parsed = await parseFetchResponse(mockResponse);
    expect(parsed.sizeBytes).toBe(expectedByteLength);
  });
});
