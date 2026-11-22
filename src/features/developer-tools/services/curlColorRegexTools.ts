import { parseCurlCommand, ParsedCurlResult } from '../../../services/request/curlParser';

export interface EnhancedCurlParseResult extends ParsedCurlResult {
  unsupportedFlags: string[];
  warnings: string[];
}

const KNOWN_UNSUPPORTED_FLAGS: Record<string, string> = {
  '--insecure': 'TLS verification cannot be disabled by browser Fetch.',
  '-k': 'TLS verification cannot be disabled by browser Fetch.',
  '--cert': 'Client mTLS certificates require native execution (planned for Phase 7).',
  '--key': 'Client private keys require native execution (planned for Phase 7).',
  '--cacert': 'Custom CA bundles require native execution (planned for Phase 7).',
  '--socks5': 'SOCKS proxies are not configurable from browser JavaScript.',
  '--proxy': 'HTTP proxies are governed by browser/OS network settings.',
  '-x': 'HTTP proxies are governed by browser/OS network settings.',
  '--resolve': 'Custom DNS overrides are not supported in browser Fetch.',
  '--cookie-jar': 'Cookie jar file output is not supported.',
  '--http2': 'HTTP version negotiation is managed automatically by the browser.',
};

/**
 * Safely parses a cURL command without invoking any shell, surfacing unsupported options cleanly.
 */
export function inspectAndParseCurl(rawCommand: string): EnhancedCurlParseResult {
  const base = parseCurlCommand(rawCommand);
  const unsupportedFlags: string[] = [];
  const warnings: string[] = [];

  const tokens = rawCommand.split(/\s+/);
  for (const t of tokens) {
    const cleanFlag = t.split('=')[0];
    if (KNOWN_UNSUPPORTED_FLAGS[cleanFlag]) {
      if (!unsupportedFlags.includes(cleanFlag)) {
        unsupportedFlags.push(cleanFlag);
        warnings.push(`${cleanFlag}: ${KNOWN_UNSUPPORTED_FLAGS[cleanFlag]}`);
      }
    }
  }

  return {
    ...base,
    unsupportedFlags,
    warnings,
  };
}

// ===================== Color Converter =====================

export interface ColorConversions {
  valid: boolean;
  hex?: string;
  hexAlpha?: string;
  rgb?: string;
  rgba?: string;
  hsl?: string;
  hsla?: string;
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  error?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

export function parseAndConvertColor(input: string): ColorConversions {
  const raw = (input || '').trim();
  if (!raw) return { valid: false, error: 'Enter a HEX, RGB(A), or HSL(A) color value.' };

  let r = 0;
  let g = 0;
  let b = 0;
  let a = 1;

  const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  const rgbMatch = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([01]?(?:\.\d+)?))?\s*\)$/i);
  const hslMatch = raw.match(/^hsla?\(\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(\d{1,3}(?:\.\d+)?)%?\s*,\s*(\d{1,3}(?:\.\d+)?)%?(?:\s*,\s*([01]?(?:\.\d+)?))?\s*\)$/i);

  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    if (hex.length === 8) {
      a = Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 100) / 100;
    }
  } else if (rgbMatch) {
    r = clamp(parseInt(rgbMatch[1], 10), 0, 255);
    g = clamp(parseInt(rgbMatch[2], 10), 0, 255);
    b = clamp(parseInt(rgbMatch[3], 10), 0, 255);
    a = rgbMatch[4] !== undefined ? clamp(parseFloat(rgbMatch[4]), 0, 1) : 1;
  } else if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]);
    const l = parseFloat(hslMatch[3]);
    a = hslMatch[4] !== undefined ? clamp(parseFloat(hslMatch[4]), 0, 1) : 1;
    const rgb = hslToRgb(h, s, l);
    r = rgb.r;
    g = rgb.g;
    b = rgb.b;
  } else {
    return {
      valid: false,
      error: 'Unsupported color format. Try #3B82F6, rgb(59, 130, 246), or hsl(217, 91%, 60%).',
    };
  }

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const alphaByte = toHex(Math.round(a * 255));
  const hexAlpha = `${hex}${alphaByte}`;
  const { h, s, l } = rgbToHsl(r, g, b);

  return {
    valid: true,
    r,
    g,
    b,
    a,
    hex,
    hexAlpha,
    rgb: `rgb(${r}, ${g}, ${b})`,
    rgba: `rgba(${r}, ${g}, ${b}, ${a})`,
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
    hsla: `hsla(${h}, ${s}%, ${l}%, ${a})`,
  };
}

// ===================== Safe Regex Tester =====================

export interface RegexMatchEntry {
  index: number;
  endIndex: number;
  match: string;
  groups: string[];
  namedGroups?: Record<string, string>;
}

export interface RegexTestResult {
  valid: boolean;
  matches: RegexMatchEntry[];
  warning?: string;
  error?: string;
}

const MAX_REGEX_INPUT_LENGTH = 50000;
const MAX_REGEX_MATCHES = 500;
const MAX_REGEX_EXEC_MS = 100;

/**
 * Heuristic check for nested quantifiers prone to catastrophic ReDoS backtracking.
 */
export function hasNestedQuantifierRisk(pattern: string): boolean {
  return /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/.test(pattern);
}

export function testRegexSafely(
  pattern: string,
  flags: string,
  testText: string
): RegexTestResult {
  if (!pattern) {
    return { valid: true, matches: [] };
  }

  if (testText.length > MAX_REGEX_INPUT_LENGTH) {
    return {
      valid: false,
      matches: [],
      error: `Test input exceeds safety cap of ${MAX_REGEX_INPUT_LENGTH.toLocaleString()} characters.`,
    };
  }

  const cleanFlags = Array.from(new Set(flags.replace(/[^gimsuyd]/g, '').split(''))).join('');
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, cleanFlags);
  } catch (err) {
    return {
      valid: false,
      matches: [],
      error: err instanceof Error ? err.message : 'Invalid regular expression',
    };
  }

  if (hasNestedQuantifierRisk(pattern)) {
    return {
      valid: false,
      matches: [],
      error:
        'Pattern contains nested quantifiers (e.g. (a+)+) which can cause catastrophic backtracking and freeze the browser.',
    };
  }

  const matches: RegexMatchEntry[] = [];
  const startedAt = performance.now();
  let warning: string | undefined;

  if (!regex.global && !regex.sticky) {
    const m = regex.exec(testText);
    if (m) {
      matches.push({
        index: m.index,
        endIndex: m.index + m[0].length,
        match: m[0],
        groups: m.slice(1).map((g) => g ?? ''),
        namedGroups: m.groups ? { ...m.groups } : undefined,
      });
    }
    return { valid: true, matches };
  }

  let match: RegExpExecArray | null;
  while ((match = regex.exec(testText)) !== null) {
    matches.push({
      index: match.index,
      endIndex: match.index + match[0].length,
      match: match[0],
      groups: match.slice(1).map((g) => g ?? ''),
      namedGroups: match.groups ? { ...match.groups } : undefined,
    });

    if (match[0].length === 0) {
      regex.lastIndex++;
    }

    if (matches.length >= MAX_REGEX_MATCHES) {
      warning = `Stopped after ${MAX_REGEX_MATCHES} matches to keep UI responsive.`;
      break;
    }

    if (performance.now() - startedAt > MAX_REGEX_EXEC_MS) {
      warning = `Regex evaluation halted after ${MAX_REGEX_EXEC_MS}ms safety limit.`;
      break;
    }
  }

  return { valid: true, matches, warning };
}
