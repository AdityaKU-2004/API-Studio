import {
  ApiRequest,
  OpenApiSpecRecord,
  CollectionItem,
  DependencyEdge,
  DependencyGraphData,
  DependencyNode,
  Environment,
} from '../../types';
import { parseOpenApiDocument } from '../openapi/openapiParser';

export function buildDependencyGraph(params: {
  collections: CollectionItem[];
  requests: ApiRequest[];
  specs: OpenApiSpecRecord[];
  environments: Environment[];
}): DependencyGraphData {
  const nodesMap = new Map<string, DependencyNode>();
  const edgesMap = new Map<string, DependencyEdge>();

  const addNode = (node: Omit<DependencyNode, 'x' | 'y'>) => {
    if (!nodesMap.has(node.id)) {
      nodesMap.set(node.id, { ...node, x: 0, y: 0 });
    }
  };

  const addEdge = (edge: Omit<DependencyEdge, 'id'>) => {
    const key = `${edge.sourceId}::${edge.kind}::${edge.targetId}`;
    if (!edgesMap.has(key)) {
      edgesMap.set(key, { id: `edge-${edgesMap.size + 1}`, ...edge });
    }
  };

  // 1. OpenAPI specs -> Server host nodes + Endpoint nodes + Auth scheme nodes
  for (const spec of params.specs) {
    const specNodeId = `api:${spec.id}`;
    addNode({
      id: specNodeId,
      label: spec.name,
      kind: 'api',
      subtitle: `OpenAPI v${spec.version}`,
    });

    try {
      const parsed = parseOpenApiDocument(spec.content);
      for (const srv of parsed.servers) {
        const srvId = `svc:${srv.url}`;
        addNode({
          id: srvId,
          label: srv.url,
          kind: 'service',
          subtitle: srv.description || 'OpenAPI Server',
        });
        addEdge({
          sourceId: specNodeId,
          targetId: srvId,
          kind: 'calls',
          certainty: 'explicit',
          evidence: `Declared under servers in ${spec.name}`,
        });
      }

      for (const ep of parsed.endpoints.slice(0, 25)) {
        const epId = `ep:${spec.id}:${ep.method}:${ep.path}`;
        addNode({
          id: epId,
          label: `${ep.method} ${ep.path}`,
          kind: 'endpoint',
          subtitle: ep.summary || spec.name,
        });
        addEdge({
          sourceId: specNodeId,
          targetId: epId,
          kind: 'uses',
          certainty: 'explicit',
          evidence: `Endpoint defined in OpenAPI spec '${spec.name}'`,
        });
      }
    } catch {
      // Ignore draft spec parse errors
    }
  }

  // 2. Collections -> Requests -> Hosts, {{Variables}}, & Script Chaining
  const collectionMap = new Map<string, string>();
  const collectNames = (items: CollectionItem[]) => {
    for (const it of items) {
      if (it.type === 'collection') {
        collectionMap.set(it.id, it.name);
        addNode({
          id: `col:${it.id}`,
          label: it.name,
          kind: 'collection',
          subtitle: 'Collection',
        });
      }
      if (it.children) collectNames(it.children);
    }
  };
  collectNames(params.collections);

  for (const req of params.requests) {
    const reqNodeId = `ep:req:${req.id}`;
    addNode({
      id: reqNodeId,
      label: `${req.method} ${req.name}`,
      kind: 'endpoint',
      subtitle: req.url,
    });

    if (req.collectionId && collectionMap.has(req.collectionId)) {
      addEdge({
        sourceId: `col:${req.collectionId}`,
        targetId: reqNodeId,
        kind: 'uses',
        certainty: 'explicit',
        evidence: `Request belongs to collection '${collectionMap.get(req.collectionId)}'`,
      });
    }

    // Host target extraction
    try {
      const cleanUrl = req.url.replace(/\{\{[^}]+\}\}/g, 'placeholder.local');
      const u = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
      if (u.host && u.host !== 'placeholder.local') {
        const svcId = `svc:${u.origin}`;
        addNode({ id: svcId, label: u.host, kind: 'service', subtitle: u.origin });
        addEdge({
          sourceId: reqNodeId,
          targetId: svcId,
          kind: 'calls',
          certainty: 'inferred',
          evidence: `Inferred host '${u.host}' from request URL`,
        });
      }
    } catch {
      // Ignore malformed draft URLs
    }

    // {{variable}} references
    const combinedText = `${req.url}\n${req.rawBody || ''}\n${req.headers.map((h) => h.value).join('\n')}`;
    const varMatches = combinedText.matchAll(/\{\{([A-Za-z0-9_.-]+)\}\}/g);
    for (const m of varMatches) {
      const varKey = m[1];
      const varNodeId = `var:${varKey}`;
      addNode({ id: varNodeId, label: `{{${varKey}}}`, kind: 'variable', subtitle: 'Variable' });
      addEdge({
        sourceId: reqNodeId,
        targetId: varNodeId,
        kind: 'references',
        certainty: 'explicit',
        evidence: `Template reference {{${varKey}}} found in '${req.name}'`,
      });
    }

    // Script variable chaining (pm.environment.set / setEnvironmentVariable)
    const scriptText = [
      req.scripts?.postResponse?.script,
      req.testScript,
      req.scripts?.preRequest?.script,
      req.preRequestScript,
    ]
      .filter(Boolean)
      .join('\n');
    const setMatches = scriptText.matchAll(
      /(?:setEnvironmentVariable|environment\.set)\(\s*['"]([A-Za-z0-9_.-]+)['"]/g
    );
    for (const m of setMatches) {
      const producedKey = m[1];
      const varNodeId = `var:${producedKey}`;
      addNode({
        id: varNodeId,
        label: `{{${producedKey}}}`,
        kind: 'variable',
        subtitle: 'Script-produced variable',
      });
      addEdge({
        sourceId: reqNodeId,
        targetId: varNodeId,
        kind: 'depends-on',
        certainty: 'inferred',
        evidence: `Script in '${req.name}' writes '${producedKey}'`,
      });
    }

    // Shared auth link
    if (req.auth && req.auth.type !== 'none') {
      const authNodeId = `svc:auth:${req.auth.type}`;
      addNode({
        id: authNodeId,
        label: `Auth: ${req.auth.type}`,
        kind: 'service',
        subtitle: 'Authentication Scheme',
      });
      addEdge({
        sourceId: reqNodeId,
        targetId: authNodeId,
        kind: 'shares-auth',
        certainty: 'explicit',
        evidence: `Request configured with '${req.auth.type}' authentication`,
      });
    }
  }

  // 3. Environments -> Variable definitions
  for (const env of params.environments) {
    const envId = `env:${env.id}`;
    addNode({
      id: envId,
      label: env.name,
      kind: 'environment',
      subtitle: `${env.variables.length} vars`,
    });
    for (const v of env.variables) {
      const varNodeId = `var:${v.key}`;
      if (nodesMap.has(varNodeId)) {
        addEdge({
          sourceId: envId,
          targetId: varNodeId,
          kind: 'uses',
          certainty: 'explicit',
          evidence: `Environment '${env.name}' supplies '${v.key}'`,
        });
      }
    }
  }

  // 4. Deterministic layered SVG layout grouped by node kind
  const columns: Record<DependencyNode['kind'], number> = {
    environment: 80,
    variable: 290,
    collection: 500,
    api: 500,
    endpoint: 740,
    service: 980,
  };
  const rowCounts: Record<number, number> = {};
  const nodes = Array.from(nodesMap.values()).map((n) => {
    const x = columns[n.kind] ?? 400;
    const row = rowCounts[x] || 0;
    rowCounts[x] = row + 1;
    return {
      ...n,
      x,
      y: 70 + row * 82,
    };
  });

  return {
    id: `dep-${Date.now()}`,
    name: 'Workspace API Dependency Graph',
    generatedAt: Date.now(),
    nodes,
    edges: Array.from(edgesMap.values()),
  };
}

export function exportDependencyGraphAsMermaid(graph: DependencyGraphData): string {
  const safeId = (id: string) => id.replace(/[^A-Za-z0-9_]/g, '_');
  const lines = ['flowchart LR'];
  for (const n of graph.nodes) {
    const label = n.label.replace(/"/g, "'");
    lines.push(`  ${safeId(n.id)}["${label} (${n.kind})"]`);
  }
  for (const e of graph.edges) {
    const arrow = e.certainty === 'explicit' ? `-->|${e.kind}|` : `-.->|${e.kind} inferred|`;
    lines.push(`  ${safeId(e.sourceId)} ${arrow} ${safeId(e.targetId)}`);
  }
  return lines.join('\n');
}
