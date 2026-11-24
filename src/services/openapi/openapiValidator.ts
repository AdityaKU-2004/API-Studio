import { OpenApiValidationIssue } from '../../types';
import { detectSpecVersionKind, parseRawSpecObject } from './openapiParser';

const VALID_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

function findLineAndColumn(raw: string, searchKey: string): { line: number; column: number } {
  if (!searchKey) return { line: 1, column: 1 };
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf(searchKey);
    if (idx !== -1) {
      return { line: i + 1, column: idx + 1 };
    }
  }
  return { line: 1, column: 1 };
}

export function validateOpenApiSpec(raw: string): OpenApiValidationIssue[] {
  const issues: OpenApiValidationIssue[] = [];
  const pushIssue = (
    severity: OpenApiValidationIssue['severity'],
    message: string,
    path: string,
    hintKey?: string
  ) => {
    const pos = findLineAndColumn(raw, hintKey || path.split('.').pop() || '');
    issues.push({
      id: `val-${issues.length + 1}`,
      severity,
      message,
      path,
      line: pos.line,
      column: pos.column,
    });
  };

  if (!raw.trim()) {
    pushIssue('error', 'Specification content cannot be empty.', 'root');
    return issues;
  }

  let doc: Record<string, unknown>;
  try {
    doc = parseRawSpecObject(raw).doc;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to parse YAML/JSON';
    const match = msg.match(/line\s+(\d+)/i);
    const lineNum = match ? Number(match[1]) : 1;
    issues.push({
      id: 'val-parse-error',
      severity: 'error',
      message: msg,
      path: 'root',
      line: lineNum,
      column: 1,
    });
    return issues;
  }

  const kind = detectSpecVersionKind(doc);
  if (kind === 'unknown') {
    pushIssue(
      'error',
      'Missing or unsupported specification version. Declare `openapi: 3.0.x`, `openapi: 3.1.x`, or `swagger: "2.0"`.',
      'openapi',
      'openapi'
    );
  }

  const info = doc.info as Record<string, unknown> | undefined;
  if (!info || typeof info !== 'object') {
    pushIssue('error', 'Missing required `info` metadata object.', 'info', 'info');
  } else {
    if (!info.title || typeof info.title !== 'string') {
      pushIssue('error', 'Missing required `info.title` string.', 'info.title', 'title');
    }
    if (!info.version || typeof info.version !== 'string') {
      pushIssue('error', 'Missing required `info.version` string.', 'info.version', 'version');
    }
    if (!info.description) {
      pushIssue(
        'info',
        'Consider adding `info.description` to enrich generated API documentation.',
        'info.description',
        'info'
      );
    }
  }

  if (kind !== 'swagger-2.0') {
    if (!Array.isArray(doc.servers) || doc.servers.length === 0) {
      pushIssue(
        'warning',
        'No `servers` configured. Contract testing and generated requests will fall back to {{base_url}}.',
        'servers',
        'servers'
      );
    }
  }

  const paths = doc.paths as Record<string, unknown> | undefined;
  if (!paths || typeof paths !== 'object' || Object.keys(paths).length === 0) {
    pushIssue('warning', 'Specification defines no endpoints under `paths`.', 'paths', 'paths');
    return issues;
  }

  const operationIds = new Set<string>();
  for (const [pathKey, pathVal] of Object.entries(paths)) {
    if (!pathKey.startsWith('/')) {
      pushIssue('error', `Path "${pathKey}" must begin with a forward slash "/".`, `paths.${pathKey}`, pathKey);
    }

    if (!pathVal || typeof pathVal !== 'object') continue;
    const pathObj = pathVal as Record<string, unknown>;

    for (const [methodKey, opVal] of Object.entries(pathObj)) {
      if (!VALID_METHODS.has(methodKey.toLowerCase())) continue;
      if (!opVal || typeof opVal !== 'object') continue;
      const op = opVal as Record<string, unknown>;
      const opPath = `paths.${pathKey}.${methodKey}`;

      if (typeof op.operationId === 'string') {
        if (operationIds.has(op.operationId)) {
          pushIssue(
            'warning',
            `Duplicate operationId "${op.operationId}" detected.`,
            `${opPath}.operationId`,
            op.operationId
          );
        }
        operationIds.add(op.operationId);
      } else {
        pushIssue(
          'info',
          `Operation ${methodKey.toUpperCase()} ${pathKey} has no operationId.`,
          opPath,
          pathKey
        );
      }

      if (!op.responses || typeof op.responses !== 'object' || Object.keys(op.responses).length === 0) {
        pushIssue(
          'error',
          `Operation ${methodKey.toUpperCase()} ${pathKey} must declare at least one response.`,
          `${opPath}.responses`,
          pathKey
        );
      }

      // Check path template parameters exist in parameters list
      const pathParams = Array.from(pathKey.matchAll(/\{([^}]+)\}/g)).map((m) => m[1]);
      const declaredParams = [
        ...(Array.isArray(pathObj.parameters) ? pathObj.parameters : []),
        ...(Array.isArray(op.parameters) ? op.parameters : []),
      ] as Array<Record<string, unknown>>;

      for (const pp of pathParams) {
        const found = declaredParams.some((dp) => dp?.name === pp && dp?.in === 'path');
        if (!found) {
          pushIssue(
            'warning',
            `Path variable "{${pp}}" on ${pathKey} is missing a corresponding \`in: path\` parameter definition.`,
            `${opPath}.parameters`,
            pathKey
          );
        }
      }
    }
  }

  return issues;
}
