import { describe, it, expect } from 'vitest';
import { validateAndFormatJson, convertJsonToTypeScript } from '../../features/developer-tools/services/jsonTools';
import {
  decodeJwtLocal,
  encodeBase64Unicode,
  decodeBase64Unicode,
  encodeUrlValue,
  decodeUrlValue,
  parseQueryParametersString,
  formatQueryParametersString,
} from '../../features/developer-tools/services/tokenAndCodecTools';
import {
  generateHash,
  generateUuidBatch,
  convertTimestampInput,
} from '../../features/developer-tools/services/cryptoAndIdTools';
import {
  inspectAndParseCurl,
  parseAndConvertColor,
  testRegexSafely,
} from '../../features/developer-tools/services/curlColorRegexTools';
import { certificateInspector } from '../../features/ssl/certificateService';

function toBase64Url(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('Phase 6: Developer Utilities & SSL Inspector', () => {
  it('formats, minifies, and converts JSON to TypeScript interfaces', () => {
    const formatted = validateAndFormatJson('{"b":2,"a":[1]}', 2);
    expect(formatted.valid).toBe(true);
    expect(formatted.minified).toBe('{"b":2,"a":[1]}');

    const bad = validateAndFormatJson('{"a": }');
    expect(bad.valid).toBe(false);
    expect(bad.errorMessage).toBeDefined();

    const ts = convertJsonToTypeScript('{"user":{"id":1,"tags":["dev"]}}', 'Payload');
    expect(ts.success).toBe(true);
    expect(ts.code).toContain('export interface Payload');
    expect(ts.code).toContain('tags: string[]');
  });

  it('decodes JWT locally without claiming signature verification', () => {
    const expiredExp = Math.floor(Date.now() / 1000) - 3600;
    const token = `${toBase64Url({ alg: 'HS256', typ: 'JWT' })}.${toBase64Url({
      sub: 'user-9',
      iss: 'api-studio',
      exp: expiredExp,
    })}.fake-sig`;

    const decoded = decodeJwtLocal(token);
    expect(decoded.validStructure).toBe(true);
    expect(decoded.signatureVerified).toBe(false);
    expect(decoded.expirationStatus).toBe('expired');
    expect(decoded.subject).toBe('user-9');
    expect(decoded.securityNotice.toLowerCase()).toContain('signature');
  });

  it('handles Unicode Base64 and URL codec / query parameter building', () => {
    const original = 'API Studio — café ✓ 🚀';
    const enc = encodeBase64Unicode(original);
    expect(enc.success).toBe(true);
    const dec = decodeBase64Unicode(enc.output);
    expect(dec.success).toBe(true);
    expect(dec.output).toBe(original);

    const urlEnc = encodeUrlValue('a b&c=1', 'component');
    expect(urlEnc.output).toBe('a%20b%26c%3D1');
    expect(decodeUrlValue(urlEnc.output, 'component').output).toBe('a b&c=1');

    const params = parseQueryParametersString('https://api.test/search?q=hello&page=2');
    expect(params).toEqual([
      { key: 'q', value: 'hello' },
      { key: 'page', value: '2' },
    ]);
    expect(formatQueryParametersString('https://api.test/search', params)).toBe(
      'https://api.test/search?q=hello&page=2'
    );
  });

  it('generates SHA-256/SHA-512 hashes, CSPRNG UUID v4, and converts timestamps', async () => {
    const sha256 = await generateHash('abc', 'SHA-256');
    expect(sha256).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

    const sha512 = await generateHash('abc', 'SHA-512');
    expect(sha512).toHaveLength(128);

    const uuids = generateUuidBatch(3);
    expect(uuids).toHaveLength(3);
    for (const id of uuids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }

    const ts = convertTimestampInput('1700000000');
    expect(ts.valid).toBe(true);
    expect(ts.iso8601).toBe('2023-11-14T22:13:20.000Z');
  });

  it('inspects cURL unsupported flags, converts colors, protects regex against ReDoS, and explains browser SSL boundaries', async () => {
    const curl = inspectAndParseCurl("curl --insecure --socks5 localhost:9050 -X POST https://api.test/x -d '{}'");
    expect(curl.success).toBe(true);
    expect(curl.request?.method).toBe('POST');
    expect(curl.unsupportedFlags).toContain('--insecure');
    expect(curl.unsupportedFlags).toContain('--socks5');

    const color = parseAndConvertColor('#3B82F6');
    expect(color.valid).toBe(true);
    expect(color.rgb).toBe('rgb(59, 130, 246)');
    expect(color.hsl).toBe('hsl(217, 91%, 60%)');

    const safeRegex = testRegexSafely('(?<kind>user|post)-(\\d+)', 'g', 'user-12 post-99');
    expect(safeRegex.valid).toBe(true);
    expect(safeRegex.matches).toHaveLength(2);
    expect(safeRegex.matches[0].namedGroups?.kind).toBe('user');

    const dangerousRegex = testRegexSafely('(a+)+$', '', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!');
    expect(dangerousRegex.valid).toBe(false);
    expect(dangerousRegex.error).toMatch(/nested quantifiers/i);

    const ssl = await certificateInspector.inspect('https://api.github.com');
    expect(ssl.availableInBrowser).toBe(false);
    expect(ssl.certificate).toBeNull();
    expect(ssl.browserNotice.length).toBeGreaterThan(20);
  });
});
