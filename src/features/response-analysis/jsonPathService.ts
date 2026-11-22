import { JSONPath } from 'jsonpath-plus';

export interface JsonPathMatch {
  path: string;
  value: unknown;
}

export interface JsonPathEvaluationResult {
  valid: boolean;
  matches: JsonPathMatch[];
  values: unknown[];
  error?: string;
}

/**
 * Evaluates a JSONPath expression against parsed JSON using `jsonpath-plus`.
 */
export function evaluateJsonPath(
  jsonInput: unknown,
  expression: string
): JsonPathEvaluationResult {
  const expr = (expression || '').trim();
  if (!expr) {
    return { valid: false, matches: [], values: [], error: 'Enter a JSONPath expression (e.g. $.data or $[*].id).' };
  }

  let target = jsonInput;
  if (typeof jsonInput === 'string') {
    try {
      target = JSON.parse(jsonInput);
    } catch (err) {
      return {
        valid: false,
        matches: [],
        values: [],
        error: err instanceof Error ? `Invalid JSON input: ${err.message}` : 'Invalid JSON input',
      };
    }
  }

  if (target === undefined || target === null || typeof target !== 'object') {
    return {
      valid: false,
      matches: [],
      values: [],
      error: 'JSONPath queries require a JSON object or array.',
    };
  }

  // Basic structural bracket check before invoking library
  if (!expr.startsWith('$') && !expr.startsWith('@')) {
    return {
      valid: false,
      matches: [],
      values: [],
      error: 'JSONPath expressions must start with "$" (root) or "@".',
    };
  }

  let openSquare = 0;
  let openParen = 0;
  for (const ch of expr) {
    if (ch === '[') openSquare++;
    else if (ch === ']') openSquare--;
    else if (ch === '(') openParen++;
    else if (ch === ')') openParen--;
    if (openSquare < 0 || openParen < 0) {
      return {
        valid: false,
        matches: [],
        values: [],
        error: 'Syntax error: unmatched closing bracket or parenthesis in JSONPath.',
      };
    }
  }
  if (openSquare !== 0 || openParen !== 0) {
    return {
      valid: false,
      matches: [],
      values: [],
      error: 'Syntax error: unclosed bracket or parenthesis in JSONPath.',
    };
  }

  try {
    const rawMatches = JSONPath({
      path: expr,
      json: target as object,
      resultType: 'all',
      eval: false,
    }) as Array<{ path: string; value: unknown }>;

    const matches: JsonPathMatch[] = Array.isArray(rawMatches)
      ? rawMatches.map((m) => ({
          path: m.path,
          value: m.value,
        }))
      : [];

    return {
      valid: true,
      matches,
      values: matches.map((m) => m.value),
    };
  } catch (err) {
    return {
      valid: false,
      matches: [],
      values: [],
      error: err instanceof Error ? err.message : 'Failed to evaluate JSONPath expression',
    };
  }
}
