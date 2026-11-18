import { ApiResponse, AssertionResult, AssertionRule } from '../../types';

/**
 * Safely resolves dot/bracket paths like `data.items[0].name` or `$.user.email` against a parsed JSON object.
 */
export function resolveJsonPath(obj: unknown, path?: string): { found: boolean; value: unknown } {
  if (obj === null || obj === undefined) return { found: false, value: undefined };
  if (!path || !path.trim() || path.trim() === '$' || path.trim() === '.') {
    return { found: true, value: obj };
  }

  let normalized = path.trim();
  if (normalized.startsWith('$.')) normalized = normalized.slice(2);
  else if (normalized.startsWith('$')) normalized = normalized.slice(1);
  if (normalized.startsWith('.')) normalized = normalized.slice(1);

  // Convert bracket notation [0] or ['key'] into dot notation
  const segments = normalized
    .replace(/\[(['"]?)([^'"\]]+)\1\]/g, '.$2')
    .split('.')
    .filter(Boolean);

  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) {
      return { found: false, value: undefined };
    }
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (Number.isInteger(idx) && idx >= 0 && idx < current.length) {
        current = current[idx];
      } else {
        return { found: false, value: undefined };
      }
    } else if (typeof current === 'object') {
      const record = current as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(record, seg)) {
        current = record[seg];
      } else {
        return { found: false, value: undefined };
      }
    } else {
      return { found: false, value: undefined };
    }
  }

  return { found: true, value: current };
}

function getHeaderCaseInsensitive(headers: Record<string, string>, name?: string): { found: boolean; value?: string } {
  if (!name) return { found: false };
  const lower = name.trim().toLowerCase();
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === lower) {
      return { found: true, value: v };
    }
  }
  return { found: false };
}

function getParsedResponseBody(response: ApiResponse): { validJson: boolean; data: unknown } {
  if (response.parsedBody !== undefined) {
    return { validJson: true, data: response.parsedBody };
  }
  if (!response.body) return { validJson: false, data: undefined };
  try {
    return { validJson: true, data: JSON.parse(response.body) };
  } catch {
    return { validJson: false, data: response.body };
  }
}

function getValueTypeName(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

function stringifyCompact(val: unknown): string {
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

export function evaluateAssertionRule(rule: AssertionRule, response: ApiResponse): AssertionResult {
  const start = performance.now();
  const displayName = rule.name?.trim() || `${rule.category} ${rule.operator} ${rule.expectedValue ?? ''}`.trim();

  if (!rule.enabled) {
    return {
      id: `ares-${rule.id}`,
      ruleId: rule.id,
      name: displayName,
      group: rule.group,
      category: rule.category,
      status: 'skipped',
      passed: true,
      durationMs: 0,
      source: 'assertion',
    };
  }

  const finish = (passed: boolean, expected?: string, actual?: string, error?: string): AssertionResult => ({
    id: `ares-${rule.id}`,
    ruleId: rule.id,
    name: displayName,
    group: rule.group,
    category: rule.category,
    status: passed ? 'passed' : 'failed',
    passed,
    expected,
    actual,
    error: passed ? undefined : error,
    durationMs: Math.round((performance.now() - start) * 100) / 100,
    source: 'assertion',
  });

  try {
    // 1. STATUS CODE ASSERTIONS
    if (rule.category === 'status') {
      const code = response.status;
      const exp = Number(rule.expectedValue);
      const expMax = Number(rule.expectedValueMax);

      switch (rule.operator) {
        case 'equals':
          return finish(code === exp, String(exp), String(code), `Expected status ${exp} but received ${code}`);
        case 'notEquals':
          return finish(code !== exp, `!= ${exp}`, String(code), `Expected status not to equal ${exp}`);
        case 'between':
          return finish(
            code >= exp && code <= expMax,
            `${exp}..${expMax}`,
            String(code),
            `Expected status ${code} to be between ${exp} and ${expMax}`
          );
        case 'is2xx':
          return finish(code >= 200 && code < 300, '200..299 (2xx)', String(code), `Expected 2xx status but got ${code}`);
        case 'is4xx':
          return finish(code >= 400 && code < 500, '400..499 (4xx)', String(code), `Expected 4xx status but got ${code}`);
        case 'is5xx':
          return finish(code >= 500 && code < 600, '500..599 (5xx)', String(code), `Expected 5xx status but got ${code}`);
        default:
          return finish(false, rule.expectedValue, String(code), `Unsupported operator "${rule.operator}" for status`);
      }
    }

    // 2. RESPONSE TIME ASSERTIONS
    if (rule.category === 'responseTime') {
      const ms = response.timeMs;
      const threshold = Number(rule.expectedValue);
      const maxThreshold = Number(rule.expectedValueMax);

      switch (rule.operator) {
        case 'lessThan':
          return finish(ms < threshold, `< ${threshold}ms`, `${ms}ms`, `Response time ${ms}ms was not less than ${threshold}ms`);
        case 'greaterThan':
          return finish(ms > threshold, `> ${threshold}ms`, `${ms}ms`, `Response time ${ms}ms was not greater than ${threshold}ms`);
        case 'between':
          return finish(
            ms >= threshold && ms <= maxThreshold,
            `${threshold}ms..${maxThreshold}ms`,
            `${ms}ms`,
            `Response time ${ms}ms outside [${threshold}ms, ${maxThreshold}ms]`
          );
        default:
          return finish(false, rule.expectedValue, `${ms}ms`, `Unsupported operator "${rule.operator}" for responseTime`);
      }
    }

    // 3. CONTENT TYPE ASSERTIONS
    if (rule.category === 'contentType') {
      const ct = (response.contentType || getHeaderCaseInsensitive(response.headers, 'content-type').value || '').toLowerCase();
      const target = (rule.expectedValue || '').trim().toLowerCase();

      switch (rule.operator) {
        case 'equals':
          return finish(ct === target || ct.split(';')[0].trim() === target, target, ct, `Expected Content-Type "${target}" but got "${ct}"`);
        case 'contains':
          return finish(ct.includes(target), `contains "${target}"`, ct, `Content-Type "${ct}" does not include "${target}"`);
        case 'exists':
          return finish(ct.length > 0, 'present', ct || 'missing', 'Content-Type header is missing');
        default:
          return finish(false, target, ct, `Unsupported operator "${rule.operator}" for contentType`);
      }
    }

    // 4. RESPONSE HEADER ASSERTIONS
    if (rule.category === 'headers') {
      const headerName = (rule.target || '').trim();
      const { found, value } = getHeaderCaseInsensitive(response.headers, headerName);
      const expected = rule.expectedValue ?? '';

      switch (rule.operator) {
        case 'exists':
          return finish(found, `Header "${headerName}" exists`, found ? value : 'missing', `Header "${headerName}" was not found`);
        case 'notExists':
          return finish(!found, `Header "${headerName}" absent`, found ? value : 'absent', `Expected header "${headerName}" not to exist`);
        case 'equals':
          return finish(
            found && String(value) === expected,
            expected,
            found ? value : 'missing',
            `Expected header "${headerName}" to equal "${expected}" but got "${value ?? 'missing'}"`
          );
        case 'notEquals':
          return finish(
            found && String(value) !== expected,
            `!= ${expected}`,
            found ? value : 'missing',
            `Expected header "${headerName}" not to equal "${expected}"`
          );
        case 'contains':
          return finish(
            found && String(value).toLowerCase().includes(expected.toLowerCase()),
            `contains "${expected}"`,
            found ? value : 'missing',
            `Header "${headerName}" value "${value ?? ''}" does not contain "${expected}"`
          );
        default:
          return finish(false, expected, value, `Unsupported operator "${rule.operator}" for headers`);
      }
    }

    // 5. RESPONSE BODY ASSERTIONS
    if (rule.category === 'body') {
      const targetPath = (rule.target || '').trim();
      const { validJson, data } = getParsedResponseBody(response);

      // If targetPath is empty, check raw body text
      if (!targetPath) {
        const raw = response.body || '';
        const exp = rule.expectedValue ?? '';
        switch (rule.operator) {
          case 'notEmpty':
            return finish(raw.trim().length > 0, 'non-empty body', `${raw.length} chars`, 'Response body is empty');
          case 'contains':
            return finish(raw.includes(exp), `contains "${exp}"`, raw.slice(0, 120), `Response body does not contain "${exp}"`);
          case 'notContains':
            return finish(!raw.includes(exp), `not contains "${exp}"`, raw.slice(0, 120), `Response body unexpectedly contains "${exp}"`);
          case 'equals':
            return finish(raw === exp, exp, raw.slice(0, 120), 'Response body does not match expected value');
          case 'matchesRegex': {
            const re = new RegExp(exp);
            return finish(re.test(raw), `matches /${exp}/`, raw.slice(0, 120), `Response body did not match /${exp}/`);
          }
          case 'arrayLength': {
            const len = Array.isArray(data) ? data.length : -1;
            const expLen = Number(exp);
            return finish(
              Array.isArray(data) && len === expLen,
              `array length ${expLen}`,
              Array.isArray(data) ? `array length ${len}` : getValueTypeName(data),
              `Expected root array length ${expLen} but got ${len}`
            );
          }
          case 'arrayContains': {
            const foundInArr =
              Array.isArray(data) &&
              data.some((item) => stringifyCompact(item) === exp || String(item) === exp);
            return finish(
              foundInArr,
              `array contains ${exp}`,
              stringifyCompact(data).slice(0, 120),
              `Root array does not contain ${exp}`
            );
          }
          case 'isType': {
            const targetObj = validJson ? data : raw;
            const actualType = getValueTypeName(targetObj);
            return finish(
              actualType === exp.toLowerCase(),
              exp.toLowerCase(),
              actualType,
              `Expected body type "${exp.toLowerCase()}" but got "${actualType}"`
            );
          }
          default:
            return finish(false, exp, raw.slice(0, 80), `Specify a property path or use raw body operator`);
        }
      }

      if (!validJson) {
        return finish(false, `Property "${targetPath}"`, 'Non-JSON body', 'Response body is not valid JSON');
      }

      const { found, value } = resolveJsonPath(data, targetPath);
      const exp = rule.expectedValue ?? '';

      switch (rule.operator) {
        case 'exists':
          return finish(found && value !== undefined, `"${targetPath}" exists`, found ? stringifyCompact(value) : 'missing', `Property "${targetPath}" does not exist`);
        case 'notExists':
          return finish(!found, `"${targetPath}" does not exist`, found ? stringifyCompact(value) : 'absent', `Property "${targetPath}" unexpectedly exists`);
        case 'notEmpty': {
          const ok =
            found &&
            value !== null &&
            value !== undefined &&
            (typeof value === 'string'
              ? value.trim().length > 0
              : Array.isArray(value)
              ? value.length > 0
              : typeof value === 'object'
              ? Object.keys(value as object).length > 0
              : true);
          return finish(ok, `"${targetPath}" not empty`, found ? stringifyCompact(value) : 'missing', `Property "${targetPath}" is empty or missing`);
        }
        case 'equals':
          return finish(
            found && (String(value) === exp || stringifyCompact(value) === exp),
            exp,
            found ? stringifyCompact(value) : 'missing',
            `Expected "${targetPath}" to equal "${exp}" but got ${stringifyCompact(value)}`
          );
        case 'notEquals':
          return finish(
            found && String(value) !== exp,
            `!= ${exp}`,
            found ? stringifyCompact(value) : 'missing',
            `Expected "${targetPath}" not to equal "${exp}"`
          );
        case 'contains': {
          const text = found ? (typeof value === 'string' ? value : stringifyCompact(value)) : '';
          return finish(
            found && text.includes(exp),
            `contains "${exp}"`,
            found ? text : 'missing',
            `Property "${targetPath}" (${text}) does not contain "${exp}"`
          );
        }
        case 'notContains': {
          const text = found ? (typeof value === 'string' ? value : stringifyCompact(value)) : '';
          return finish(
            found && !text.includes(exp),
            `not contains "${exp}"`,
            found ? text : 'missing',
            `Property "${targetPath}" unexpectedly contains "${exp}"`
          );
        }
        case 'arrayContains': {
          const ok =
            found &&
            Array.isArray(value) &&
            value.some((el) => String(el) === exp || stringifyCompact(el) === exp);
          return finish(
            ok,
            `array contains ${exp}`,
            found ? stringifyCompact(value) : 'missing',
            `Array at "${targetPath}" does not contain "${exp}"`
          );
        }
        case 'arrayLength': {
          const expLen = Number(exp);
          const actualLen = Array.isArray(value) ? value.length : -1;
          return finish(
            found && Array.isArray(value) && actualLen === expLen,
            `length ${expLen}`,
            Array.isArray(value) ? `length ${actualLen}` : getValueTypeName(value),
            `Expected "${targetPath}" array length ${expLen} but got ${actualLen}`
          );
        }
        case 'isType': {
          const actualType = found ? getValueTypeName(value) : 'undefined';
          return finish(
            found && actualType === exp.toLowerCase(),
            exp.toLowerCase(),
            actualType,
            `Expected "${targetPath}" to have type "${exp.toLowerCase()}" but got "${actualType}"`
          );
        }
        case 'matchesRegex': {
          const re = new RegExp(exp);
          const strVal = found ? String(value) : '';
          return finish(
            found && re.test(strVal),
            `matches /${exp}/`,
            found ? strVal : 'missing',
            `Property "${targetPath}" value "${strVal}" did not match /${exp}/`
          );
        }
        case 'lessThan': {
          const num = Number(value);
          const target = Number(exp);
          return finish(
            found && !Number.isNaN(num) && num < target,
            `< ${target}`,
            String(value),
            `Expected "${targetPath}" (${value}) < ${target}`
          );
        }
        case 'greaterThan': {
          const num = Number(value);
          const target = Number(exp);
          return finish(
            found && !Number.isNaN(num) && num > target,
            `> ${target}`,
            String(value),
            `Expected "${targetPath}" (${value}) > ${target}`
          );
        }
        default:
          return finish(false, exp, stringifyCompact(value), `Unsupported operator "${rule.operator}"`);
      }
    }

    return finish(false, rule.expectedValue, undefined, `Unknown assertion category "${rule.category}"`);
  } catch (err) {
    return finish(false, rule.expectedValue, undefined, err instanceof Error ? err.message : String(err));
  }
}
