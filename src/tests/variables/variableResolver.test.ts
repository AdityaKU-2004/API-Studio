import { describe, it, expect } from 'vitest';
import {
  resolveTemplateString,
  buildEffectiveVariableMap,
  maskSecretValues,
} from '../../services/variables/variableResolver';
import { EnvironmentVariable } from '../../types';

describe('Phase 4: Variable Substitution Engine', () => {
  it('resolves variables respecting the 5-tier precedence hierarchy', () => {
    // Hierarchical resolution order: Request > Environment > Folder > Collection > Global
    const globalVars: EnvironmentVariable[] = [
      { id: '1', key: 'api_key', initialValue: 'global-key', currentValue: 'global-key', enabled: true, scope: 'global' },
      { id: '2', key: 'base_url', initialValue: 'https://global.api', currentValue: 'https://global.api', enabled: true, scope: 'global' },
    ];

    const collectionVars: EnvironmentVariable[] = [
      { id: '3', key: 'api_key', initialValue: 'collection-key', currentValue: 'collection-key', enabled: true, scope: 'collection' },
      { id: '4', key: 'version', initialValue: 'v1', currentValue: 'v1', enabled: true, scope: 'collection' },
    ];

    const folderVars: EnvironmentVariable[] = [
      { id: '5', key: 'api_key', initialValue: 'folder-key', currentValue: 'folder-key', enabled: true, scope: 'folder' },
    ];

    const envVars: EnvironmentVariable[] = [
      { id: '6', key: 'api_key', initialValue: 'env-key', currentValue: 'env-key', enabled: true, scope: 'environment' },
    ];

    const requestVars: EnvironmentVariable[] = [
      { id: '7', key: 'api_key', initialValue: 'req-key', currentValue: 'req-key', enabled: true, scope: 'request' },
    ];

    // Case 1: All scopes present -> Request scope wins
    const mapWithAll = buildEffectiveVariableMap({
      globalVars,
      collectionVars,
      folderVars,
      environmentVars: envVars,
      requestVars,
    });
    expect(mapWithAll.api_key.value).toBe('req-key');
    expect(mapWithAll.api_key.source).toBe('request');

    // Case 2: Without request scope -> Environment scope wins
    const mapWithEnv = buildEffectiveVariableMap({
      globalVars,
      collectionVars,
      folderVars,
      environmentVars: envVars,
    });
    expect(mapWithEnv.api_key.value).toBe('env-key');
    expect(mapWithEnv.api_key.source).toBe('environment');

    // Case 3: Without environment scope -> Folder scope wins
    const mapWithFolder = buildEffectiveVariableMap({
      globalVars,
      collectionVars,
      folderVars,
    });
    expect(mapWithFolder.api_key.value).toBe('folder-key');
    expect(mapWithFolder.api_key.source).toBe('folder');

    // Case 4: Without folder scope -> Collection scope wins
    const mapWithCol = buildEffectiveVariableMap({
      globalVars,
      collectionVars,
    });
    expect(mapWithCol.api_key.value).toBe('collection-key');
    expect(mapWithCol.api_key.source).toBe('collection');

    // Case 5: Only global scope -> Global scope wins
    const mapGlobalOnly = buildEffectiveVariableMap({
      globalVars,
    });
    expect(mapGlobalOnly.api_key.value).toBe('global-key');
    expect(mapGlobalOnly.api_key.source).toBe('global');
  });

  it('substitutes template strings and warns on undefined variables', () => {
    const vars = {
      base_url: 'https://api.acme.io',
      user_id: '42',
    };

    const template = '{{base_url}}/users/{{user_id}}/profile?filter={{missing_var}}';
    const result = resolveTemplateString(template, vars);

    expect(result.resolved).toBe('https://api.acme.io/users/42/profile?filter={{missing_var}}');
    expect(result.undefinedVariables).toEqual(['missing_var']);
  });

  it('resolves nested variable references', () => {
    const vars = {
      domain: 'acme.io',
      api_host: 'api.{{domain}}',
      endpoint: 'https://{{api_host}}/v1',
    };

    const template = '{{endpoint}}/data';
    const result = resolveTemplateString(template, vars);

    expect(result.resolved).toBe('https://api.acme.io/v1/data');
    expect(result.hasCircularReference).toBe(false);
  });

  it('detects and handles circular variable references without infinite loops', () => {
    const vars = {
      alpha: '{{beta}}',
      beta: '{{gamma}}',
      gamma: '{{alpha}}',
    };

    const template = 'Value: {{alpha}}';
    const result = resolveTemplateString(template, vars);

    expect(result.hasCircularReference).toBe(true);
    expect(result.circularVariables.length).toBeGreaterThan(0);
    // Should terminate gracefully and not freeze
    expect(typeof result.resolved).toBe('string');
  });

  it('masks secret values correctly', () => {
    const effectiveVars = {
      api_key: { value: 'super-secret-12345', isSecret: true, source: 'environment' as const },
      base_url: { value: 'https://api.test', isSecret: false, source: 'global' as const },
    };

    const masked = maskSecretValues(effectiveVars);
    expect(masked.api_key).toBe('••••••••');
    expect(masked.base_url).toBe('https://api.test');
  });
});
