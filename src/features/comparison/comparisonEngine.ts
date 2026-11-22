import { diffLines } from 'diff';
import {
  ComparisonResult,
  ComparisonSource,
  HeaderDiffEntry,
  JsonDiffEntry,
  TextDiffLine,
} from '../../types';
import { isSensitiveHeaderName, maskSecretValue } from '../../services/protocols/http/diagnosticsAnalyzer';

function getJsonValueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Recursively compares two JSON-serializable values and produces exact JSONPath diff entries.
 */
export function compareJsonValues(
  left: unknown,
  right: unknown,
  path = '$'
): JsonDiffEntry[] {
  const diffs: JsonDiffEntry[] = [];
  const leftType = getJsonValueType(left);
  const rightType = getJsonValueType(right);

  if (leftType !== rightType) {
    diffs.push({
      path,
      type: 'type_changed',
      leftValue: left,
      rightValue: right,
      leftType,
      rightType,
    });
    return diffs;
  }

  if (leftType === 'array') {
    const leftArr = left as unknown[];
    const rightArr = right as unknown[];
    const maxLen = Math.max(leftArr.length, rightArr.length);

    for (let i = 0; i < maxLen; i++) {
      const elemPath = `${path}[${i}]`;
      if (i >= leftArr.length) {
        diffs.push({
          path: elemPath,
          type: 'added',
          rightValue: rightArr[i],
          rightType: getJsonValueType(rightArr[i]),
        });
      } else if (i >= rightArr.length) {
        diffs.push({
          path: elemPath,
          type: 'removed',
          leftValue: leftArr[i],
          leftType: getJsonValueType(leftArr[i]),
        });
      } else {
        diffs.push(...compareJsonValues(leftArr[i], rightArr[i], elemPath));
      }
    }
    return diffs;
  }

  if (leftType === 'object') {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);

    for (const key of Array.from(allKeys).sort()) {
      const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `.${key}`
        : `["${key.replace(/"/g, '\\"')}"]`;
      const childPath = `${path}${safeKey}`;
      const inLeft = Object.prototype.hasOwnProperty.call(leftObj, key);
      const inRight = Object.prototype.hasOwnProperty.call(rightObj, key);

      if (!inLeft && inRight) {
        diffs.push({
          path: childPath,
          type: 'added',
          rightValue: rightObj[key],
          rightType: getJsonValueType(rightObj[key]),
        });
      } else if (inLeft && !inRight) {
        diffs.push({
          path: childPath,
          type: 'removed',
          leftValue: leftObj[key],
          leftType: getJsonValueType(leftObj[key]),
        });
      } else {
        diffs.push(...compareJsonValues(leftObj[key], rightObj[key], childPath));
      }
    }
    return diffs;
  }

  // Primitive comparison
  if (!Object.is(left, right)) {
    diffs.push({
      path,
      type: 'modified',
      leftValue: left,
      rightValue: right,
      leftType,
      rightType,
    });
  }

  return diffs;
}

/**
 * Line-by-line text comparison using the `diff` package.
 */
export function compareTextLines(leftText: string, rightText: string): TextDiffLine[] {
  const changes = diffLines(leftText || '', rightText || '');
  const lines: TextDiffLine[] = [];
  let leftLine = 1;
  let rightLine = 1;

  for (const part of changes) {
    const rawLines = part.value.split('\n');
    // Remove trailing empty line caused by trailing newline
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }

    for (const line of rawLines) {
      if (part.added) {
        lines.push({
          type: 'added',
          value: line,
          lineNumberRight: rightLine++,
        });
      } else if (part.removed) {
        lines.push({
          type: 'removed',
          value: line,
          lineNumberLeft: leftLine++,
        });
      } else {
        lines.push({
          type: 'unchanged',
          value: line,
          lineNumberLeft: leftLine++,
          lineNumberRight: rightLine++,
        });
      }
    }
  }

  return lines;
}

/**
 * Compares HTTP headers with optional masking for sensitive credentials.
 */
export function compareHeaders(
  leftHeaders: Record<string, string>,
  rightHeaders: Record<string, string>,
  maskSensitive = true
): { diffs: HeaderDiffEntry[]; sensitiveDetected: string[] } {
  const leftNormalized = new Map<string, { originalKey: string; value: string }>();
  const rightNormalized = new Map<string, { originalKey: string; value: string }>();

  for (const [k, v] of Object.entries(leftHeaders || {})) {
    leftNormalized.set(k.toLowerCase(), { originalKey: k, value: v });
  }
  for (const [k, v] of Object.entries(rightHeaders || {})) {
    rightNormalized.set(k.toLowerCase(), { originalKey: k, value: v });
  }

  const allKeys = new Set([...leftNormalized.keys(), ...rightNormalized.keys()]);
  const diffs: HeaderDiffEntry[] = [];
  const sensitiveSet = new Set<string>();

  for (const lowerKey of Array.from(allKeys).sort()) {
    const l = leftNormalized.get(lowerKey);
    const r = rightNormalized.get(lowerKey);
    const displayKey = l?.originalKey || r?.originalKey || lowerKey;
    const isSensitive = isSensitiveHeaderName(lowerKey);

    if (isSensitive) {
      sensitiveSet.add(displayKey);
    }

    const lVal = l ? (maskSensitive && isSensitive ? maskSecretValue(l.value) : l.value) : undefined;
    const rVal = r ? (maskSensitive && isSensitive ? maskSecretValue(r.value) : r.value) : undefined;

    if (l && !r) {
      diffs.push({ key: displayKey, status: 'only_left', leftValue: lVal, isSensitive });
    } else if (!l && r) {
      diffs.push({ key: displayKey, status: 'only_right', rightValue: rVal, isSensitive });
    } else if (l && r) {
      // Compare raw underlying values so masking never hides real inequality
      const isEqual = l.value === r.value;
      diffs.push({
        key: displayKey,
        status: isEqual ? 'identical' : 'modified',
        leftValue: lVal,
        rightValue: rVal,
        isSensitive,
      });
    }
  }

  return { diffs, sensitiveDetected: Array.from(sensitiveSet) };
}

/**
 * Full comparison orchestrator for two HTTP/GraphQL responses.
 */
export function compareResponses(
  left: ComparisonSource,
  right: ComparisonSource,
  options: { maskSensitiveHeaders?: boolean } = {}
): ComparisonResult {
  const maskSensitive = options.maskSensitiveHeaders ?? true;
  const warnings: string[] = [];

  let isJsonComparable = false;
  let jsonDiffs: JsonDiffEntry[] = [];
  let leftFormattedForText = left.body || '';
  let rightFormattedForText = right.body || '';

  try {
    const leftParsed = JSON.parse(left.body);
    const rightParsed = JSON.parse(right.body);
    isJsonComparable = true;
    jsonDiffs = compareJsonValues(leftParsed, rightParsed, '$');
    leftFormattedForText = JSON.stringify(leftParsed, null, 2);
    rightFormattedForText = JSON.stringify(rightParsed, null, 2);
  } catch {
    isJsonComparable = false;
  }

  const textDiffLines = compareTextLines(leftFormattedForText, rightFormattedForText);
  const { diffs: headerDiffs, sensitiveDetected } = compareHeaders(
    left.headers || {},
    right.headers || {},
    maskSensitive
  );

  if (sensitiveDetected.length > 0 && !maskSensitive) {
    warnings.push(
      `Sensitive headers (${sensitiveDetected.join(', ')}) are displayed unmasked. Avoid sharing screenshots or exports.`
    );
  }

  const bodyAdditions = isJsonComparable
    ? jsonDiffs.filter((d) => d.type === 'added').length
    : textDiffLines.filter((l) => l.type === 'added').length;
  const bodyRemovals = isJsonComparable
    ? jsonDiffs.filter((d) => d.type === 'removed').length
    : textDiffLines.filter((l) => l.type === 'removed').length;
  const bodyModifications = isJsonComparable
    ? jsonDiffs.filter((d) => d.type === 'modified').length
    : 0;
  const typeChanges = isJsonComparable
    ? jsonDiffs.filter((d) => d.type === 'type_changed').length
    : 0;
  const headerDifferences = headerDiffs.filter((h) => h.status !== 'identical').length;

  const statusMatch =
    left.status !== undefined && right.status !== undefined ? left.status === right.status : true;
  const timeDeltaMs =
    left.timeMs !== undefined && right.timeMs !== undefined ? right.timeMs - left.timeMs : null;

  return {
    isJsonComparable,
    jsonDiffs,
    textDiffLines,
    headerDiffs,
    summary: {
      totalDifferences:
        bodyAdditions + bodyRemovals + bodyModifications + typeChanges + headerDifferences,
      additions: bodyAdditions,
      removals: bodyRemovals,
      modifications: bodyModifications,
      typeChanges,
      headerDifferences,
      statusMatch,
      timeDeltaMs,
      sensitiveHeadersDetected: sensitiveDetected,
    },
    warnings,
  };
}
