import {
  EnvironmentVariable,
  VariableResolutionResult,
  VariableScope,
} from '../../types';

export interface ScopedVariableContext {
  globalVariables?: EnvironmentVariable[];
  globalVars?: EnvironmentVariable[];
  collectionVariables?: EnvironmentVariable[];
  collectionVars?: EnvironmentVariable[];
  folderVariables?: EnvironmentVariable[];
  folderVars?: EnvironmentVariable[];
  environmentVariables?: EnvironmentVariable[];
  environmentVars?: EnvironmentVariable[];
  requestVariables?: EnvironmentVariable[];
  requestVars?: EnvironmentVariable[];
  [key: string]: any;
}

export type VariableInput =
  | ScopedVariableContext
  | Record<string, string | { value: string; isSecret?: boolean; source?: VariableScope; scope?: VariableScope }>;

/**
 * Combines scoped variables according to precedence:
 * Request > Environment > Folder > Collection > Global
 * More specific scope overrides less specific scope.
 */
export function buildEffectiveVariableMap(
  context: VariableInput
): Record<string, { value: string; isSecret: boolean; scope: VariableScope; source: VariableScope }> {
  const map: Record<
    string,
    { value: string; isSecret: boolean; scope: VariableScope; source: VariableScope }
  > = {};

  if (!context || typeof context !== 'object') {
    return map;
  }

  const isScopedContext =
    'globalVariables' in context ||
    'globalVars' in context ||
    'collectionVariables' in context ||
    'collectionVars' in context ||
    'folderVariables' in context ||
    'folderVars' in context ||
    'environmentVariables' in context ||
    'environmentVars' in context ||
    'requestVariables' in context ||
    'requestVars' in context;

  if (isScopedContext) {
    const ctx = context as ScopedVariableContext;

    // 1. Global (lowest precedence)
    const globals = ctx.globalVariables || ctx.globalVars || [];
    for (const v of globals) {
      if (v.enabled !== false && v.key?.trim()) {
        map[v.key.trim()] = {
          value: v.currentValue ?? v.initialValue ?? '',
          isSecret: !!(v.isSecret || v.secret),
          scope: 'global',
          source: 'global',
        };
      }
    }

    // 2. Collection
    const colVars = ctx.collectionVariables || ctx.collectionVars || [];
    for (const v of colVars) {
      if (v.enabled !== false && v.key?.trim()) {
        map[v.key.trim()] = {
          value: v.currentValue ?? v.initialValue ?? '',
          isSecret: !!(v.isSecret || v.secret),
          scope: 'collection',
          source: 'collection',
        };
      }
    }

    // 3. Folder
    const folderVars = ctx.folderVariables || ctx.folderVars || [];
    for (const v of folderVars) {
      if (v.enabled !== false && v.key?.trim()) {
        map[v.key.trim()] = {
          value: v.currentValue ?? v.initialValue ?? '',
          isSecret: !!(v.isSecret || v.secret),
          scope: 'folder',
          source: 'folder',
        };
      }
    }

    // 4. Active Environment
    const envVars = ctx.environmentVariables || ctx.environmentVars || [];
    for (const v of envVars) {
      if (v.enabled !== false && v.key?.trim()) {
        map[v.key.trim()] = {
          value: v.currentValue ?? v.initialValue ?? '',
          isSecret: !!(v.isSecret || v.secret),
          scope: 'environment',
          source: 'environment',
        };
      }
    }

    // 5. Request-local (highest precedence)
    const reqVars = ctx.requestVariables || ctx.requestVars || [];
    for (const v of reqVars) {
      if (v.enabled !== false && v.key?.trim()) {
        map[v.key.trim()] = {
          value: v.currentValue ?? v.initialValue ?? '',
          isSecret: !!(v.isSecret || v.secret),
          scope: 'request',
          source: 'request',
        };
      }
    }
  } else {
    // Plain dictionary of key-values
    for (const [key, val] of Object.entries(context as Record<string, any>)) {
      if (val === undefined || val === null) continue;
      if (typeof val === 'object' && 'value' in val) {
        map[key] = {
          value: String(val.value ?? ''),
          isSecret: !!(val.isSecret || val.secret),
          scope: val.scope || val.source || 'environment',
          source: val.source || val.scope || 'environment',
        };
      } else {
        map[key] = {
          value: String(val),
          isSecret: false,
          scope: 'environment',
          source: 'environment',
        };
      }
    }
  }

  return map;
}

/**
 * Resolves all {{variable_name}} expressions with circular reference & undefined variable detection.
 */
export function resolveTemplateString(
  template: string,
  context: VariableInput,
  maxDepth = 10
): VariableResolutionResult & { undefinedVariables: string[]; hasCircularReference: boolean } {
  if (!template) {
    return {
      original: '',
      resolved: '',
      unresolvedVariables: [],
      undefinedVariables: [],
      circularVariables: [],
      hasCircularReference: false,
      resolvedMap: {},
    };
  }

  const rawMap = buildEffectiveVariableMap(context);
  const unresolvedSet = new Set<string>();
  const circularSet = new Set<string>();
  const resolvedMap: Record<string, { value: string; scope: VariableScope }> = {};

  // First, resolve nested variables inside the variable map itself
  const resolvedVarMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawMap)) {
    resolvedVarMap[k] = v.value;
  }

  // Iteratively expand nested variables in the map
  for (let round = 0; round < maxDepth; round++) {
    let changed = false;
    for (const [k, v] of Object.entries(resolvedVarMap)) {
      const match = v.match(/\{\{([^}]+)\}\}/);
      if (match) {
        const refName = match[1].trim();
        if (refName === k) {
          circularSet.add(k);
          continue;
        }
        if (resolvedVarMap[refName] !== undefined) {
          const nextVal = v.replace(match[0], resolvedVarMap[refName]);
          if (nextVal.includes(`{{${k}}}`)) {
            circularSet.add(k);
            circularSet.add(refName);
          } else {
            resolvedVarMap[k] = nextVal;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }

  let current = template;
  let depth = 0;
  const visitedChains: string[] = [];

  while (depth < maxDepth) {
    const matches = Array.from(current.matchAll(/\{\{([^}]+)\}\}/g));
    if (matches.length === 0) break;

    let hasReplacedAny = false;

    for (const match of matches) {
      const fullMatch = match[0];
      const varName = match[1].trim();

      if (visitedChains.includes(varName) || circularSet.has(varName)) {
        circularSet.add(varName);
        continue;
      }

      if (resolvedVarMap[varName] !== undefined) {
        const replacementVal = resolvedVarMap[varName];
        resolvedMap[varName] = {
          value: replacementVal,
          scope: rawMap[varName]?.scope || 'environment',
        };
        current = current.replace(fullMatch, replacementVal);
        visitedChains.push(varName);
        hasReplacedAny = true;
      } else {
        unresolvedSet.add(varName);
      }
    }

    if (!hasReplacedAny) {
      break;
    }

    depth++;
  }

  const unresolvedList = Array.from(unresolvedSet);
  const circularList = Array.from(circularSet);

  return {
    original: template,
    resolved: current,
    unresolvedVariables: unresolvedList,
    undefinedVariables: unresolvedList,
    circularVariables: circularList,
    hasCircularReference: circularList.length > 0,
    resolvedMap,
  };
}

/**
 * Masks any secret variable values.
 * Supports:
 * - maskSecretValues(dictOfVariables) -> returns masked dict
 * - maskSecretValues(textString, context) -> returns masked string
 */
export function maskSecretValues(
  input: string | Record<string, any>,
  context?: VariableInput
): any {
  if (!input) return input;

  if (typeof input === 'object') {
    // Input is dictionary of variables to mask
    const result: Record<string, string> = {};
    for (const [key, item] of Object.entries(input)) {
      if (item && typeof item === 'object') {
        const isSecret = !!(item.isSecret || item.secret);
        result[key] = isSecret ? '••••••••' : String(item.value ?? '');
      } else {
        result[key] = String(item ?? '');
      }
    }
    return result;
  }

  // Input is a string text to mask secrets within
  if (typeof input === 'string') {
    if (!context) return input;
    const varMap = buildEffectiveVariableMap(context);
    let masked = input;

    for (const [, info] of Object.entries(varMap)) {
      if (info.isSecret && info.value && info.value.length >= 2) {
        masked = masked.replaceAll(info.value, '••••••••');
      }
    }

    return masked;
  }

  return input;
}
