import { EnvironmentVariable, ScriptVariableUpdates } from '../../types';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useVariableStore } from '../../stores/variableStore';
import { useCollectionStore } from '../../stores/collectionStore';

function mergeVariableArray(
  current: EnvironmentVariable[],
  updates: Record<string, string | null>,
  scope: EnvironmentVariable['scope']
): EnvironmentVariable[] {
  const list = [...current];
  for (const [key, value] of Object.entries(updates)) {
    const idx = list.findIndex((v) => v.key === key);
    if (value === null) {
      if (idx !== -1) list.splice(idx, 1);
    } else if (idx !== -1) {
      list[idx] = { ...list[idx], currentValue: value, enabled: true };
    } else {
      list.push({
        id: `var-${scope}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        key,
        initialValue: value,
        currentValue: value,
        description: `Set by ${scope} script`,
        enabled: true,
        isSecret: false,
        scope,
      });
    }
  }
  return list;
}

/**
 * Applies variable updates produced by QuickJS scripts back to Environment, Collection, and Global stores.
 */
export async function persistScriptVariableUpdates(
  updates: ScriptVariableUpdates,
  options?: {
    environmentId?: string | null;
    collectionId?: string;
  }
): Promise<void> {
  // 1. Environment variables
  if (Object.keys(updates.environment).length > 0) {
    const envStore = useEnvironmentStore.getState();
    const targetEnvId =
      options?.environmentId !== undefined ? options.environmentId : envStore.activeEnvironmentId;
    if (targetEnvId) {
      const targetEnv = envStore.environments.find((e) => e.id === targetEnvId);
      if (targetEnv) {
        const nextVars = mergeVariableArray(targetEnv.variables || [], updates.environment, 'environment');
        await envStore.updateEnvironment(targetEnvId, { variables: nextVars });
      }
    }
  }

  // 2. Collection variables
  if (Object.keys(updates.collectionVariables).length > 0 && options?.collectionId) {
    const colStore = useCollectionStore.getState();
    const targetCol = colStore.collections.find((c) => c.id === options.collectionId);
    if (targetCol) {
      const nextColVars = mergeVariableArray(
        targetCol.variables || [],
        updates.collectionVariables,
        'collection'
      );
      await colStore.updateCollection(options.collectionId, { variables: nextColVars });
    }
  }

  // 3. Global variables
  if (Object.keys(updates.globals).length > 0) {
    const varStore = useVariableStore.getState();
    for (const [key, val] of Object.entries(updates.globals)) {
      const existing = varStore.globalVariables.find((v) => v.key === key);
      if (val === null) {
        if (existing) await varStore.deleteGlobalVariable(existing.id);
      } else if (existing) {
        await varStore.updateGlobalVariable(existing.id, { currentValue: val, enabled: true });
      } else {
        await varStore.addGlobalVariable({
          key,
          initialValue: val,
          currentValue: val,
          description: 'Set by pm.globals script',
          enabled: true,
          isSecret: false,
          scope: 'global',
        });
      }
    }
  }
}
