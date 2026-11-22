export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateHash(
  input: string | ArrayBuffer | Uint8Array,
  algorithm: HashAlgorithm = 'SHA-256'
): Promise<string> {
  let data: Uint8Array;
  if (typeof input === 'string') {
    data = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    data = input;
  } else {
    data = new Uint8Array(input);
  }

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      algorithm,
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    );
    return bufferToHex(digest);
  }

  throw new Error('Web Crypto API (crypto.subtle) is unavailable in this environment.');
}

export function generateUuidV4(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
      .slice(6, 8)
      .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  throw new Error('Cryptographically secure random API (crypto) is unavailable.');
}

export function generateUuidBatch(count: number): string[] {
  const safeCount = Math.max(1, Math.min(500, Math.floor(count || 1)));
  return Array.from({ length: safeCount }, () => generateUuidV4());
}

export interface TimestampConversionResult {
  valid: boolean;
  unixSeconds?: number;
  unixMilliseconds?: number;
  iso8601?: string;
  utcString?: string;
  localString?: string;
  relativeDescription?: string;
  error?: string;
}

export function convertTimestampInput(rawInput: string): TimestampConversionResult {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter a Unix timestamp (seconds/ms) or ISO 8601 date string.' };
  }

  let date: Date;

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
      return { valid: false, error: 'Numeric timestamp is out of finite range.' };
    }
    // Heuristic: < 1e12 is treated as seconds unless explicitly > 12 digits
    const ms = Math.abs(num) < 1e12 ? num * 1000 : num;
    date = new Date(ms);
  } else {
    const parsedMs = Date.parse(trimmed);
    if (Number.isNaN(parsedMs)) {
      return { valid: false, error: `Could not parse "${trimmed}" as a valid date or Unix timestamp.` };
    }
    date = new Date(parsedMs);
  }

  if (Number.isNaN(date.getTime())) {
    return { valid: false, error: 'Timestamp resolves to an invalid Date.' };
  }

  const ms = date.getTime();
  const sec = Math.floor(ms / 1000);
  const diffSec = Math.round((ms - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  const unit =
    absSec < 60
      ? `${absSec}s`
      : absSec < 3600
      ? `${Math.floor(absSec / 60)}m`
      : absSec < 86400
      ? `${Math.floor(absSec / 3600)}h`
      : `${Math.floor(absSec / 86400)}d`;
  const relativeDescription =
    diffSec === 0 ? 'now' : diffSec > 0 ? `in ${unit}` : `${unit} ago`;

  return {
    valid: true,
    unixSeconds: sec,
    unixMilliseconds: ms,
    iso8601: date.toISOString(),
    utcString: date.toUTCString(),
    localString: date.toLocaleString(),
    relativeDescription,
  };
}
