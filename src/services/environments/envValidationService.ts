import {
  Environment,
  EnvironmentDiffEntry,
  EnvironmentProfileType,
  EnvironmentTemplateFile,
  EnvironmentValidationIssue,
  EnvironmentValidationResult,
  EnvironmentVariable,
} from '../../types';

function maskForComparison(value: string, isSecret: boolean): string {
  if (!isSecret) return value;
  if (!value) return '(empty secret)';
  return '•••••••• (masked secret)';
}

export function compareEnvironments(
  left: Environment,
  right: Environment
): EnvironmentDiffEntry[] {
  const leftMap = new Map(left.variables.map((v) => [v.key, v]));
  const rightMap = new Map(right.variables.map((v) => [v.key, v]));
  const allKeys = Array.from(
    new Set([...left.variables.map((v) => v.key), ...right.variables.map((v) => v.key)])
  ).sort();

  const entries: EnvironmentDiffEntry[] = [];
  for (const key of allKeys) {
    const lVar = leftMap.get(key);
    const rVar = rightMap.get(key);
    const isSecret = Boolean(lVar?.isSecret || rVar?.isSecret);

    if (!lVar && rVar) {
      entries.push({
        key,
        changeType: 'added',
        rightValueMasked: maskForComparison(rVar.currentValue || rVar.initialValue, isSecret),
        isSecret,
      });
    } else if (lVar && !rVar) {
      entries.push({
        key,
        changeType: 'removed',
        leftValueMasked: maskForComparison(lVar.currentValue || lVar.initialValue, isSecret),
        isSecret,
      });
    } else if (lVar && rVar) {
      const lRaw = lVar.currentValue || lVar.initialValue;
      const rRaw = rVar.currentValue || rVar.initialValue;
      const changed = lRaw !== rRaw || lVar.enabled !== rVar.enabled;
      entries.push({
        key,
        changeType: changed ? 'changed' : 'unchanged',
        leftValueMasked: maskForComparison(lRaw, isSecret),
        rightValueMasked: maskForComparison(rRaw, isSecret),
        isSecret,
      });
    }
  }
  return entries;
}

export function validateEnvironmentConfiguration(params: {
  environment: Environment;
  globalVariables?: EnvironmentVariable[];
  requiredKeys?: string[];
  referencedVariablesInRequests?: string[];
}): EnvironmentValidationResult {
  const {
    environment,
    globalVariables = [],
    requiredKeys = ['base_url'],
    referencedVariablesInRequests = [],
  } = params;
  const issues: EnvironmentValidationIssue[] = [];
  const makeId = () => `evi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const seenKeys = new Map<string, number>();
  const availableKeys = new Set<string>(
    globalVariables.filter((g) => g.enabled).map((g) => g.key)
  );

  for (const v of environment.variables) {
    const key = v.key.trim();
    if (!key) {
      issues.push({
        id: makeId(),
        severity: 'error',
        key: '(empty)',
        category: 'missing-required',
        message: 'Variable entry has an empty key name.',
      });
      continue;
    }

    const count = (seenKeys.get(key) || 0) + 1;
    seenKeys.set(key, count);
    if (count > 1) {
      issues.push({
        id: makeId(),
        severity: 'warning',
        key,
        category: 'duplicate-key',
        message: `Duplicate variable key '${key}' appears multiple times in '${environment.name}'.`,
      });
    }

    if (v.enabled) {
      availableKeys.add(key);
    }

    const rawVal = (v.currentValue || v.initialValue || '').trim();

    if (/url|endpoint|host|base/i.test(key) && v.enabled && rawVal && !rawVal.includes('{{')) {
      try {
        const parsed = new URL(rawVal.startsWith('http') ? rawVal : `https://${rawVal}`);
        if (!parsed.hostname) throw new Error('Missing host');
      } catch {
        issues.push({
          id: makeId(),
          severity: 'error',
          key,
          category: 'invalid-url',
          message: `Variable '${key}' has invalid URL/host format '${rawVal}'.`,
        });
      }
    }

    if (/port/i.test(key) && v.enabled && rawVal) {
      const portNum = Number(rawVal);
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        issues.push({
          id: makeId(),
          severity: 'error',
          key,
          category: 'invalid-type',
          message: `Port variable '${key}' must be an integer between 1 and 65535.`,
        });
      }
    }

    if (/timeout|limit|retries/i.test(key) && v.enabled && rawVal) {
      if (Number.isNaN(Number(rawVal))) {
        issues.push({
          id: makeId(),
          severity: 'warning',
          key,
          category: 'invalid-type',
          message: `Numeric configuration '${key}' contains non-numeric value '${rawVal}'.`,
        });
      }
    }

    const credRef = (v as { credentialRef?: string }).credentialRef;
    if ((v.isSecret || v.secret) && credRef && !credRef.startsWith('apistudio:')) {
      issues.push({
        id: makeId(),
        severity: 'error',
        key,
        category: 'invalid-secret-ref',
        message: `Secret reference '${credRef}' does not match OS keyring prefix 'apistudio:'.`,
      });
    }
  }

  for (const reqKey of requiredKeys) {
    if (!availableKeys.has(reqKey)) {
      issues.push({
        id: makeId(),
        severity: 'warning',
        key: reqKey,
        category: 'missing-required',
        message: `Recommended variable '${reqKey}' is not defined or enabled in '${environment.name}'.`,
      });
    }
  }

  for (const refVar of referencedVariablesInRequests) {
    if (!availableKeys.has(refVar)) {
      issues.push({
        id: makeId(),
        severity: 'warning',
        key: refVar,
        category: 'unresolved-reference',
        message: `Variable '{{${refVar}}}' referenced in requests is unresolved in '${environment.name}'.`,
      });
    }
  }

  return {
    id: `eval-${environment.id}-${Date.now()}`,
    environmentId: environment.id,
    environmentName: environment.name,
    checkedAt: Date.now(),
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}

export function exportEnvironmentAsSafeTemplate(
  environment: Environment
): EnvironmentTemplateFile {
  return {
    templateFormat: 'api-studio-env-template-v1',
    name: `${environment.name} Template`,
    profileType: (environment.profileType || 'custom') as EnvironmentProfileType,
    description: environment.description,
    includesSecrets: false,
    exportedAt: Date.now(),
    variables: environment.variables.map((v) => ({
      key: v.key,
      initialValue: v.isSecret || v.secret ? '' : v.initialValue || v.currentValue || '',
      description: v.description || '',
      isSecret: Boolean(v.isSecret || v.secret),
      enabled: v.enabled,
    })),
  };
}

export function parseEnvironmentTemplatePreview(rawJson: string): {
  valid: boolean;
  template?: EnvironmentTemplateFile;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    if (
      !parsed ||
      parsed.templateFormat !== 'api-studio-env-template-v1' ||
      !Array.isArray(parsed.variables)
    ) {
      return {
        valid: false,
        error: 'JSON file does not match api-studio-env-template-v1 format.',
      };
    }
    const sanitized: EnvironmentTemplateFile = {
      templateFormat: 'api-studio-env-template-v1',
      name: String(parsed.name || 'Imported Environment'),
      profileType: parsed.profileType || 'custom',
      description: parsed.description ? String(parsed.description) : undefined,
      includesSecrets: false,
      exportedAt: Number(parsed.exportedAt || Date.now()),
      variables: parsed.variables.map((v: Record<string, unknown>) => ({
        key: String(v.key || ''),
        initialValue: v.isSecret ? '' : String(v.initialValue || ''),
        description: String(v.description || ''),
        isSecret: Boolean(v.isSecret),
        enabled: v.enabled !== false,
      })),
    };
    return { valid: true, template: sanitized };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid JSON template file.',
    };
  }
}
