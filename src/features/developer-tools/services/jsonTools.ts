export interface JsonValidationResult {
  valid: boolean;
  formatted?: string;
  minified?: string;
  parsed?: unknown;
  errorMessage?: string;
  line?: number;
  column?: number;
}

export function validateAndFormatJson(input: string, indent = 2): JsonValidationResult {
  if (!input.trim()) {
    return { valid: false, errorMessage: 'JSON input is empty.' };
  }
  try {
    const parsed = JSON.parse(input);
    return {
      valid: true,
      parsed,
      formatted: JSON.stringify(parsed, null, indent),
      minified: JSON.stringify(parsed),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let line: number | undefined;
    let column: number | undefined;

    // Extract "position N" or "line L column C" from JS engine error messages
    const lineColMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      column = parseInt(lineColMatch[2], 10);
    } else {
      const posMatch = msg.match(/position\s+(\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const upToPos = input.slice(0, pos);
        const lines = upToPos.split('\n');
        line = lines.length;
        column = lines[lines.length - 1].length + 1;
      }
    }

    return {
      valid: false,
      errorMessage: msg,
      line,
      column,
    };
  }
}

function toPascalCase(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_]+/g, ' ').trim();
  if (!cleaned) return 'GeneratedType';
  const parts = cleaned.split(/\s+/);
  const pascal = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return /^[0-9]/.test(pascal) ? `T${pascal}` : pascal;
}

function isSafeIdentifier(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

/**
 * Converts a JSON example into TypeScript interfaces.
 * Note: Inference from a single sample cannot guarantee runtime optionality or exact union exhaustiveness.
 */
export function convertJsonToTypeScript(
  jsonText: string,
  rootName = 'Root'
): { success: boolean; code: string; error?: string; caveats: string[] } {
  const validation = validateAndFormatJson(jsonText);
  if (!validation.valid) {
    return {
      success: false,
      code: '',
      error: validation.errorMessage,
      caveats: [],
    };
  }

  const rootInterfaceName = toPascalCase(rootName || 'Root');
  const interfaces = new Map<string, string>();

  const inferType = (value: unknown, suggestedName: string): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'unknown[]';

      const allObjects = value.every(
        (item) => item !== null && typeof item === 'object' && !Array.isArray(item)
      );

      if (allObjects) {
        const itemInterfaceName = toPascalCase(suggestedName.replace(/s$/i, '') || `${suggestedName}Item`);
        buildMergedObjectInterface(value as Array<Record<string, unknown>>, itemInterfaceName);
        return `${itemInterfaceName}[]`;
      }

      const memberTypes = Array.from(new Set(value.map((item) => inferType(item, suggestedName))));
      return memberTypes.length === 1
        ? `${memberTypes[0]}[]`
        : `Array<${memberTypes.join(' | ')}>`;
    }

    if (typeof value === 'object') {
      const ifaceName = toPascalCase(suggestedName);
      buildMergedObjectInterface([value as Record<string, unknown>], ifaceName);
      return ifaceName;
    }

    return typeof value; // 'string' | 'number' | 'boolean'
  };

  const buildMergedObjectInterface = (
    objects: Array<Record<string, unknown>>,
    ifaceName: string
  ) => {
    let uniqueName = ifaceName;
    if (interfaces.has(uniqueName) && objects.length === 1) {
      // Avoid collision when nested objects share a generic field name
      let suffix = 2;
      while (interfaces.has(`${ifaceName}${suffix}`)) suffix++;
      uniqueName = `${ifaceName}${suffix}`;
    }

    const keyCounts = new Map<string, number>();
    const keyValues = new Map<string, unknown[]>();

    for (const obj of objects) {
      for (const [k, v] of Object.entries(obj)) {
        keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
        const arr = keyValues.get(k) || [];
        arr.push(v);
        keyValues.set(k, arr);
      }
    }

    const lines: string[] = [`export interface ${uniqueName} {`];
    for (const [key, values] of keyValues.entries()) {
      const isOptional = values.length < objects.length;
      const inferredTypes = Array.from(
        new Set(values.map((val) => inferType(val, `${uniqueName}_${key}`)))
      );
      const formattedKey = isSafeIdentifier(key) ? key : JSON.stringify(key);
      lines.push(`  ${formattedKey}${isOptional ? '?' : ''}: ${inferredTypes.join(' | ')};`);
    }
    lines.push('}');
    interfaces.set(uniqueName, lines.join('\n'));
  };

  const rootVal = validation.parsed;
  if (rootVal !== null && typeof rootVal === 'object' && !Array.isArray(rootVal)) {
    buildMergedObjectInterface([rootVal as Record<string, unknown>], rootInterfaceName);
  } else {
    const rootType = inferType(rootVal, rootInterfaceName);
    interfaces.set(rootInterfaceName, `export type ${rootInterfaceName} = ${rootType};`);
  }

  // Put Root interface first, followed by nested interfaces
  const entries = Array.from(interfaces.entries());
  const rootEntry = entries.find(([k]) => k === rootInterfaceName);
  const others = entries.filter(([k]) => k !== rootInterfaceName);
  const orderedCode = [...(rootEntry ? [rootEntry[1]] : []), ...others.map(([, v]) => v)].join(
    '\n\n'
  );

  return {
    success: true,
    code: orderedCode,
    caveats: [
      'Types are inferred strictly from the provided JSON sample.',
      'Null values or missing keys across array elements produce union/optional fields; verify against your API contract.',
    ],
  };
}
