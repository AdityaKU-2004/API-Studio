import { describe, it, expect, vi, afterEach } from 'vitest';
import { SseStreamParser } from '../../services/protocols/sse/sseParser';
import { BrowserSseClient } from '../../services/protocols/sse/sseClient';

describe('Phase 6: SSE Stream Parser & Fetch ReadableStream Client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses chunked multi-line data events, comments, IDs, and retry fields across chunk boundaries', () => {
    const parser = new SseStreamParser();

    const batch1 = parser.feed(': heartbeat comment\r\nevent: price');
    expect(batch1).toHaveLength(0);

    const batch2 = parser.feed('_tick\r\nid: evt-10\ndata: {"symbol":"NVDA"}\ndata: second line\r');
    expect(batch2).toHaveLength(0);

    const batch3 = parser.feed('\n\nretry: 5000\ndata: final');
    expect(batch3).toHaveLength(1);
    expect(batch3[0].eventName).toBe('price_tick');
    expect(batch3[0].eventId).toBe('evt-10');
    expect(batch3[0].data).toBe('{"symbol":"NVDA"}\nsecond line');

    const flushed = parser.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0].eventName).toBe('message');
    expect(flushed[0].retryMs).toBe(5000);
    expect(flushed[0].eventId).toBe('evt-10');
    expect(flushed[0].data).toBe('final');
  });

  it('parses UTF-8 BOM and parses JSON payload automatically', () => {
    const parser = new SseStreamParser();
    const events = parser.feed('\uFEFFdata: {"ok":true}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].parsedJson).toEqual({ ok: true });
  });

  it('streams SSE over Fetch ReadableStream with custom headers and closes cleanly', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: status\ndata: {"step":1}\n\n'));
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new BrowserSseClient();
    const events: string[] = [];
    let openMeta: { mode: string; strategy: string } | undefined;

    await new Promise<void>((resolve) => {
      client.connect(
        'sse-tab-1',
        {
          url: '{{base}}/events',
          connectionMode: 'fetch',
          headers: [{ id: 'h1', key: 'X-Stream-Key', value: 'abc', enabled: true }],
          auth: { type: 'none' },
          withCredentials: false,
          autoReconnect: false,
          reconnectDelayMs: 1000,
          maxReconnectAttempts: 1,
          retainHistory: false,
          historyLimit: 100,
        },
        { base: 'https://stream.example.com' },
        {
          onOpen: (mode, strategy) => {
            openMeta = { mode, strategy };
          },
          onEvent: (evt) => {
            events.push(`${evt.eventName}:${evt.data}`);
          },
          onStatusChange: (status) => {
            if (status === 'closed') resolve();
          },
        }
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://stream.example.com/events');
    expect((calledInit as RequestInit).headers).toMatchObject({
      'X-Stream-Key': 'abc',
      Accept: 'text/event-stream',
    });
    expect(openMeta).toEqual({ mode: 'fetch', strategy: 'application-managed' });
    expect(events).toEqual(['status:{"step":1}']);
  });
});
