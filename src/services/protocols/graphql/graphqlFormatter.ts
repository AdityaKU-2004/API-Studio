export interface GraphQLValidationIssue {
  message: string;
  line?: number;
}

/**
 * Formats a GraphQL query/mutation/subscription document with clean 2-space indentation.
 * Preserves string literals, block strings ("""), and comments (#).
 */
export function formatGraphQLQuery(source: string): string {
  if (!source || !source.trim()) return '';

  const lines: string[] = [];
  let currentLine = '';
  let indent = 0;
  let inString = false;
  let inBlockString = false;
  let inComment = false;

  const pushLine = () => {
    const trimmed = currentLine.trim();
    if (trimmed.length > 0) {
      lines.push('  '.repeat(Math.max(0, indent)) + trimmed);
    }
    currentLine = '';
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next3 = source.slice(i, i + 3);

    if (inComment) {
      if (ch === '\n' || ch === '\r') {
        inComment = false;
        pushLine();
      } else {
        currentLine += ch;
      }
      continue;
    }

    if (inBlockString) {
      currentLine += ch;
      if (next3 === '"""') {
        currentLine += '""';
        i += 2;
        inBlockString = false;
      }
      continue;
    }

    if (inString) {
      currentLine += ch;
      if (ch === '\\' && i + 1 < source.length) {
        currentLine += source[++i];
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (next3 === '"""') {
      inBlockString = true;
      currentLine += '"""';
      i += 2;
      continue;
    }

    if (ch === '"') {
      inString = true;
      currentLine += ch;
      continue;
    }

    if (ch === '#') {
      if (currentLine.trim().length > 0) {
        currentLine += ' #';
      } else {
        currentLine += '#';
      }
      inComment = true;
      continue;
    }

    if (ch === '{') {
      currentLine = currentLine.replace(/\s+$/, '') + ' {';
      pushLine();
      indent++;
      continue;
    }

    if (ch === '}') {
      pushLine();
      indent = Math.max(0, indent - 1);
      lines.push('  '.repeat(indent) + '}');
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      pushLine();
      continue;
    }

    if (ch === '\t' || ch === ' ') {
      if (currentLine.length > 0 && !currentLine.endsWith(' ')) {
        currentLine += ' ';
      }
      continue;
    }

    currentLine += ch;
  }

  pushLine();

  return lines.join('\n').trim();
}

/**
 * Validates GraphQL query syntax for balanced braces, parentheses, and strings.
 */
export function validateGraphQLQuerySyntax(query: string): GraphQLValidationIssue[] {
  const issues: GraphQLValidationIssue[] = [];
  if (!query.trim()) {
    issues.push({ message: 'GraphQL query document is empty.', line: 1 });
    return issues;
  }

  let braceDepth = 0;
  let parenDepth = 0;
  let inString = false;
  let inBlockString = false;
  let inComment = false;
  let line = 1;

  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    if (ch === '\n') {
      line++;
      inComment = false;
      continue;
    }
    if (inComment) continue;

    if (inBlockString) {
      if (query.slice(i, i + 3) === '"""') {
        inBlockString = false;
        i += 2;
      }
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (query.slice(i, i + 3) === '"""') {
      inBlockString = true;
      i += 2;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '#') {
      inComment = true;
      continue;
    }

    if (ch === '{') braceDepth++;
    else if (ch === '}') {
      braceDepth--;
      if (braceDepth < 0) {
        issues.push({ message: 'Unexpected closing brace "}"', line });
        return issues;
      }
    } else if (ch === '(') parenDepth++;
    else if (ch === ')') {
      parenDepth--;
      if (parenDepth < 0) {
        issues.push({ message: 'Unexpected closing parenthesis ")"', line });
        return issues;
      }
    }
  }

  if (inString || inBlockString) {
    issues.push({ message: 'Unterminated string literal in GraphQL document.', line });
  }
  if (braceDepth > 0) {
    issues.push({ message: `Missing ${braceDepth} closing brace(s) "}"`, line });
  }
  if (parenDepth > 0) {
    issues.push({ message: `Missing ${parenDepth} closing parenthesis ")"`, line });
  }

  return issues;
}

/**
 * Validates and parses the JSON variables editor text.
 */
export function validateGraphQLVariables(variablesText: string): {
  valid: boolean;
  parsed: Record<string, unknown>;
  error?: string;
} {
  const trimmed = (variablesText || '').trim();
  if (!trimmed) {
    return { valid: true, parsed: {} };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        parsed: {},
        error: 'GraphQL variables must be a valid JSON object (e.g. { "id": 123 }).',
      };
    }
    return { valid: true, parsed };
  } catch (err) {
    return {
      valid: false,
      parsed: {},
      error: err instanceof Error ? `Invalid variables JSON: ${err.message}` : 'Invalid variables JSON',
    };
  }
}

/**
 * Extracts operation names from a GraphQL query document.
 */
export function extractOperationNames(query: string): string[] {
  const names: string[] = [];
  const regex = /\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(query)) !== null) {
    names.push(match[1]);
  }
  return names;
}
