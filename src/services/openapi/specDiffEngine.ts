import {
  ApiVersionEntry,
  SpecChangeItem,
  SpecDiffResult,
  OpenApiEndpointItem,
} from '../../types';
import { parseOpenApiDocument } from './openapiParser';

function extractRequiredPropNames(schema: Record<string, unknown> | undefined): string[] {
  if (!schema) return [];
  return Array.isArray(schema.required) ? schema.required.map(String) : [];
}

function extractPropTypes(schema: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!schema || !schema.properties || typeof schema.properties !== 'object') return out;
  for (const [key, prop] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
    out[key] = Array.isArray(prop?.type) ? prop.type.join('|') : String(prop?.type || 'any');
  }
  return out;
}

export function compareApiSpecVersions(
  baseVersion: ApiVersionEntry,
  targetVersion: ApiVersionEntry
): SpecDiffResult {
  const baseDoc = parseOpenApiDocument(baseVersion.content);
  const targetDoc = parseOpenApiDocument(targetVersion.content);

  const baseMap = new Map<string, OpenApiEndpointItem>(
    baseDoc.endpoints.map((ep) => [`${ep.method} ${ep.path}`, ep])
  );
  const targetMap = new Map<string, OpenApiEndpointItem>(
    targetDoc.endpoints.map((ep) => [`${ep.method} ${ep.path}`, ep])
  );

  const changes: SpecChangeItem[] = [];
  let addedEndpoints = 0;
  let removedEndpoints = 0;

  const addChange = (item: Omit<SpecChangeItem, 'id'>) => {
    changes.push({
      id: `chg-${changes.length + 1}`,
      ...item,
    });
  };

  // Check removed and modified endpoints
  for (const [key, baseEp] of baseMap.entries()) {
    const targetEp = targetMap.get(key);
    if (!targetEp) {
      removedEndpoints++;
      addChange({
        category: 'endpoint-removed',
        severity: 'breaking',
        path: baseEp.path,
        method: baseEp.method,
        message: `Endpoint ${key} was removed.`,
        beforeSummary: baseEp.summary || key,
        afterSummary: 'Removed',
      });
      continue;
    }

    // Compare parameters
    const baseParams = new Map(baseEp.parameters.map((p) => [`${p.in}:${p.name}`, p]));
    const targetParams = new Map(targetEp.parameters.map((p) => [`${p.in}:${p.name}`, p]));

    for (const [pKey, tp] of targetParams.entries()) {
      const bp = baseParams.get(pKey);
      if (!bp) {
        addChange({
          category: tp.required ? 'param-required-added' : 'param-optional-added',
          severity: tp.required ? 'breaking' : 'non-breaking',
          path: baseEp.path,
          method: baseEp.method,
          message: tp.required
            ? `New required ${tp.in} parameter "${tp.name}" added.`
            : `New optional ${tp.in} parameter "${tp.name}" added.`,
          beforeSummary: 'Absent',
          afterSummary: `${tp.name} (${tp.required ? 'required' : 'optional'})`,
        });
      } else if (!bp.required && tp.required) {
        addChange({
          category: 'param-required-added',
          severity: 'breaking',
          path: baseEp.path,
          method: baseEp.method,
          message: `Parameter "${tp.name}" (${tp.in}) changed from optional to required.`,
          beforeSummary: 'optional',
          afterSummary: 'required',
        });
      }
    }

    for (const [pKey, bp] of baseParams.entries()) {
      if (!targetParams.has(pKey)) {
        addChange({
          category: 'param-removed',
          severity: 'potentially-breaking',
          path: baseEp.path,
          method: baseEp.method,
          message: `Parameter "${bp.name}" (${bp.in}) was removed.`,
          beforeSummary: bp.name,
          afterSummary: 'Removed',
        });
      }
    }

    // Compare request body schema changes
    const baseReqSchema = baseEp.requestBody?.schema;
    const targetReqSchema = targetEp.requestBody?.schema;
    const baseReqRequired = new Set(extractRequiredPropNames(baseReqSchema));
    const targetReqRequired = new Set(extractRequiredPropNames(targetReqSchema));
    for (const reqProp of targetReqRequired) {
      if (!baseReqRequired.has(reqProp)) {
        addChange({
          category: 'request-schema-changed',
          severity: 'breaking',
          path: baseEp.path,
          method: baseEp.method,
          message: `Request body property "${reqProp}" became required.`,
          beforeSummary: 'optional or absent',
          afterSummary: 'required',
        });
      }
    }

    const baseReqTypes = extractPropTypes(baseReqSchema);
    const targetReqTypes = extractPropTypes(targetReqSchema);
    for (const [propName, beforeType] of Object.entries(baseReqTypes)) {
      const afterType = targetReqTypes[propName];
      if (afterType && afterType !== beforeType) {
        addChange({
          category: 'request-schema-changed',
          severity: 'breaking',
          path: baseEp.path,
          method: baseEp.method,
          message: `Request body property "${propName}" changed type from ${beforeType} to ${afterType}.`,
          beforeSummary: beforeType,
          afterSummary: afterType,
        });
      }
    }

    // Compare primary 2xx response schema changes
    const baseSuccess = baseEp.responses.find((r) => r.statusCode.startsWith('2'));
    const targetSuccess = targetEp.responses.find((r) => r.statusCode.startsWith('2'));
    if (baseSuccess && !targetSuccess) {
      addChange({
        category: 'response-schema-changed',
        severity: 'breaking',
        path: baseEp.path,
        method: baseEp.method,
        message: `Success response ${baseSuccess.statusCode} removed.`,
      });
    } else if (baseSuccess && targetSuccess) {
      const baseRespTypes = extractPropTypes(baseSuccess.schema);
      const targetRespTypes = extractPropTypes(targetSuccess.schema);
      for (const [propName, beforeType] of Object.entries(baseRespTypes)) {
        const afterType = targetRespTypes[propName];
        if (!afterType) {
          addChange({
            category: 'response-schema-changed',
            severity: 'breaking',
            path: baseEp.path,
            method: baseEp.method,
            message: `Response property "${propName}" was removed from ${targetSuccess.statusCode} payload.`,
            beforeSummary: beforeType,
            afterSummary: 'Removed',
          });
        } else if (afterType !== beforeType) {
          addChange({
            category: 'response-schema-changed',
            severity: 'breaking',
            path: baseEp.path,
            method: baseEp.method,
            message: `Response property "${propName}" type changed from ${beforeType} to ${afterType}.`,
            beforeSummary: beforeType,
            afterSummary: afterType,
          });
        }
      }
    }

    // Security changes
    const baseSec = JSON.stringify(baseEp.security || []);
    const targetSec = JSON.stringify(targetEp.security || []);
    if (baseSec !== targetSec) {
      addChange({
        category: 'auth-changed',
        severity: 'potentially-breaking',
        path: baseEp.path,
        method: baseEp.method,
        message: `Security requirements modified on ${key}.`,
        beforeSummary: baseSec,
        afterSummary: targetSec,
      });
    }
  }

  // Added endpoints
  for (const [key, targetEp] of targetMap.entries()) {
    if (!baseMap.has(key)) {
      addedEndpoints++;
      addChange({
        category: 'endpoint-added',
        severity: 'non-breaking',
        path: targetEp.path,
        method: targetEp.method,
        message: `New endpoint ${key} added.`,
        beforeSummary: 'Absent',
        afterSummary: targetEp.summary || key,
      });
    }
  }

  // Server URL changes
  const baseServers = baseDoc.servers.map((s) => s.url).join(', ');
  const targetServers = targetDoc.servers.map((s) => s.url).join(', ');
  if (baseServers !== targetServers) {
    addChange({
      category: 'server-changed',
      severity: 'potentially-breaking',
      path: 'servers',
      message: 'Server base URLs changed between versions.',
      beforeSummary: baseServers || 'None',
      afterSummary: targetServers || 'None',
    });
  }

  return {
    baseVersionId: baseVersion.id,
    targetVersionId: targetVersion.id,
    baseLabel: baseVersion.versionLabel,
    targetLabel: targetVersion.versionLabel,
    changes,
    summary: {
      breaking: changes.filter((c) => c.severity === 'breaking').length,
      potentiallyBreaking: changes.filter((c) => c.severity === 'potentially-breaking').length,
      nonBreaking: changes.filter((c) => c.severity === 'non-breaking').length,
      addedEndpoints,
      removedEndpoints,
    },
    generatedAt: Date.now(),
    disclaimer:
      'Breaking change detection is rule-based (heuristic structural comparison). Semantic API changes should still receive human review.',
  };
}
