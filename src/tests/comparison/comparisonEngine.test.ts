import { describe, it, expect } from 'vitest';
import { compareResponses } from '../../features/comparison/comparisonEngine';
import { ComparisonSource } from '../../types';

const makeSource = (overrides: Partial<ComparisonSource>): ComparisonSource => ({
  label: 'Source',
  sourceType: 'manual',
  status: 200,
  statusText: 'OK',
  timeMs: 100,
  headers: {},
  body: '{}',
  ...overrides,
});

describe('Phase 6: Response Comparison Engine', () => {
  it('detects added, removed, modified, and type-changed JSON fields with JSONPath', () => {
    const left = makeSource({
      label: 'A',
      timeMs: 150,
      body: JSON.stringify({
        id: 1,
        name: 'Alpha',
        removedKey: true,
        count: '10',
        items: ['a', 'b'],
      }),
    });

    const right = makeSource({
      label: 'B',
      timeMs: 90,
      body: JSON.stringify({
        id: 1,
        name: 'Beta',
        addedKey: 'new',
        count: 10,
        items: ['a', 'c', 'd'],
      }),
    });

    const result = compareResponses(left, right, { maskSensitiveHeaders: true });
    expect(result.isJsonComparable).toBe(true);
    expect(result.summary.timeDeltaMs).toBe(-60);
    expect(result.jsonDiffs.some((d) => d.path === '$.addedKey' && d.type === 'added')).toBe(true);
    expect(result.jsonDiffs.some((d) => d.path === '$.removedKey' && d.type === 'removed')).toBe(true);
    expect(result.jsonDiffs.some((d) => d.path === '$.name' && d.type === 'modified')).toBe(true);
    expect(result.jsonDiffs.some((d) => d.path === '$.count' && d.type === 'type_changed')).toBe(true);
    expect(result.jsonDiffs.some((d) => d.path === '$.items[1]' && d.type === 'modified')).toBe(true);
    expect(result.jsonDiffs.some((d) => d.path === '$.items[2]' && d.type === 'added')).toBe(true);
  });

  it('masks sensitive headers by default and warns when masking is disabled', () => {
    const left = makeSource({
      headers: {
        Authorization: 'Bearer secret-token-A',
        'X-Custom': 'same',
      },
    });
    const right = makeSource({
      headers: {
        Authorization: 'Bearer secret-token-B',
        'X-Custom': 'different',
      },
    });

    const maskedResult = compareResponses(left, right, { maskSensitiveHeaders: true });
    const authHeader = maskedResult.headerDiffs.find((h) => h.key.toLowerCase() === 'authorization');
    expect(authHeader?.isSensitive).toBe(true);
    expect(authHeader?.leftValue).not.toContain('secret-token-A');

    const unmaskedResult = compareResponses(left, right, { maskSensitiveHeaders: false });
    const unmaskedAuth = unmaskedResult.headerDiffs.find((h) => h.key.toLowerCase() === 'authorization');
    expect(unmaskedAuth?.leftValue).toBe('Bearer secret-token-A');
    expect(unmaskedResult.warnings.some((w) => w.toLowerCase().includes('sensitive'))).toBe(true);
  });

  it('falls back gracefully to line-by-line text diff for non-JSON payloads', () => {
    const left = makeSource({ body: 'line 1\nline 2\nline 3' });
    const right = makeSource({ body: 'line 1\nline 2 modified\nline 3\nline 4' });

    const result = compareResponses(left, right, { maskSensitiveHeaders: true });
    expect(result.isJsonComparable).toBe(false);
    expect(result.textDiffLines.some((l) => l.type === 'removed' && l.value === 'line 2')).toBe(true);
    expect(result.textDiffLines.some((l) => l.type === 'added' && l.value === 'line 2 modified')).toBe(true);
    expect(result.textDiffLines.some((l) => l.type === 'added' && l.value === 'line 4')).toBe(true);
  });
});
