import { SseEventEntry } from '../../../types';

export interface ParsedSseDispatch {
  eventName: string;
  eventId?: string;
  data: string;
  retryMs?: number;
}

/**
 * Stateful WHATWG Server-Sent Events parser.
 * Properly handles arbitrary network chunk boundaries, \r\n / \r / \n line endings,
 * multi-line data fields, event names, last-event-id tracking, and retry directives.
 */
export class SseStreamParser {
  private buffer = '';
  private currentEventName = 'message';
  private currentEventId: string | undefined = undefined;
  private currentDataLines: string[] = [];
  private currentRetryMs: number | undefined = undefined;
  private hasDispatchedIdInBlock = false;
  private lastEventId: string | undefined = undefined;

  public feed(chunkText: string): SseEventEntry[] {
    // Strip UTF-8 BOM if present at start of stream
    if (this.buffer === '' && chunkText.startsWith('\uFEFF')) {
      chunkText = chunkText.slice(1);
    }

    this.buffer += chunkText;
    const events: SseEventEntry[] = [];

    // Process complete lines terminated by \r\n, \n, or \r (wait on trailing \r in case \n follows in next chunk)
    let lineStart = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (ch === '\r') {
        if (i + 1 >= this.buffer.length) {
          // Wait for next chunk to distinguish \r vs \r\n
          break;
        }
        const line = this.buffer.slice(lineStart, i);
        if (this.buffer[i + 1] === '\n') {
          i++;
        }
        lineStart = i + 1;
        const dispatched = this.processLine(line);
        if (dispatched) events.push(dispatched);
      } else if (ch === '\n') {
        const line = this.buffer.slice(lineStart, i);
        lineStart = i + 1;
        const dispatched = this.processLine(line);
        if (dispatched) events.push(dispatched);
      }
    }

    this.buffer = this.buffer.slice(lineStart);
    return events;
  }

  public flush(): SseEventEntry[] {
    const events: SseEventEntry[] = [];
    if (this.buffer.length > 0) {
      const remaining = this.buffer.endsWith('\r') ? this.buffer.slice(0, -1) : this.buffer;
      this.buffer = '';
      if (remaining.length > 0) {
        const evt = this.processLine(remaining);
        if (evt) events.push(evt);
      }
    }
    const finalEvt = this.dispatchCurrentBlock();
    if (finalEvt) events.push(finalEvt);
    return events;
  }

  public getLastEventId(): string | undefined {
    return this.lastEventId;
  }

  private processLine(line: string): SseEventEntry | null {
    // Blank line dispatches accumulated event
    if (line === '') {
      return this.dispatchCurrentBlock();
    }

    // Comment line (starts with ':')
    if (line.startsWith(':')) {
      return null;
    }

    const colonIndex = line.indexOf(':');
    let field: string;
    let value: string;

    if (colonIndex === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIndex);
      // Per SSE spec: if value starts with single leading space, strip only that one space
      value = line[colonIndex + 1] === ' ' ? line.slice(colonIndex + 2) : line.slice(colonIndex + 1);
    }

    switch (field) {
      case 'event':
        this.currentEventName = value || 'message';
        break;
      case 'data':
        this.currentDataLines.push(value);
        break;
      case 'id':
        if (!value.includes('\0')) {
          this.currentEventId = value;
          this.lastEventId = value;
          this.hasDispatchedIdInBlock = true;
        }
        break;
      case 'retry':
        if (/^\d+$/.test(value)) {
          this.currentRetryMs = parseInt(value, 10);
        }
        break;
      default:
        break;
    }

    return null;
  }

  private dispatchCurrentBlock(): SseEventEntry | null {
    if (this.currentDataLines.length === 0) {
      // Reset event type even if no data was emitted (per SSE spec)
      this.currentEventName = 'message';
      this.hasDispatchedIdInBlock = false;
      this.currentRetryMs = undefined;
      return null;
    }

    const data = this.currentDataLines.join('\n');
    const eventName = this.currentEventName || 'message';
    const eventId = this.hasDispatchedIdInBlock ? this.currentEventId : this.lastEventId;
    const retryMs = this.currentRetryMs;

    // Reset per-event buffers (keep lastEventId across events)
    this.currentEventName = 'message';
    this.currentDataLines = [];
    this.hasDispatchedIdInBlock = false;
    this.currentRetryMs = undefined;

    let parsedJson: unknown = undefined;
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsedJson = JSON.parse(data);
      } catch {
        // leave undefined if not valid JSON
      }
    }

    return {
      id: 'sse-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      eventName,
      eventId,
      data,
      retryMs,
      parsedJson,
      rawSizeBytes: new TextEncoder().encode(data).byteLength,
    };
  }
}
