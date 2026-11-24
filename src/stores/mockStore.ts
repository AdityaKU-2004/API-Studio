import { create } from 'zustand';
import {
  MockEndpointRule,
  MockRequestLog,
  MockServerConfig,
  MockServerStatus,
} from '../types';
import { db } from '../database/database';
import {
  generateMockEndpointsFromSpec,
  nativeMockServerBridge,
  simulateLocalMockDispatch,
} from '../services/mocking/mockEngine';
import { parseOpenApiDocument } from '../services/openapi/openapiParser';
import { isTauriRuntime } from '../services/runtime/capabilities';
import { useWorkspaceStore } from './workspaceStore';

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface MockState {
  servers: MockServerConfig[];
  statuses: Record<string, MockServerStatus>;
  logs: MockRequestLog[];
  activeServerId: string | null;
  lastError: string | null;
  isLoaded: boolean;

  loadMockServers: () => Promise<void>;
  selectServer: (serverId: string) => void;
  createServer: (input: { name: string; port: number; allowLanExposure?: boolean; specId?: string }) => Promise<MockServerConfig>;
  updateServerConfig: (serverId: string, partial: Partial<MockServerConfig>) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  addEndpointRule: (serverId: string, rule?: Partial<MockEndpointRule>) => Promise<void>;
  updateEndpointRule: (serverId: string, ruleId: string, partial: Partial<MockEndpointRule>) => Promise<void>;
  deleteEndpointRule: (serverId: string, ruleId: string) => Promise<void>;
  generateFromOpenApi: (serverId: string, specContent: string) => Promise<number>;
  startServer: (serverId: string) => Promise<void>;
  stopServer: (serverId: string) => Promise<void>;
  restartServer: (serverId: string) => Promise<void>;
  simulateTestCall: (
    serverId: string,
    method: string,
    pathWithQuery: string,
    requestBody?: string
  ) => Promise<{ status: number; headers: Record<string, string>; body: string }>;
  clearLogs: (serverId: string) => Promise<void>;
  appendLog: (log: MockRequestLog) => Promise<void>;
}

let tauriMockListenerAttached = false;

export const useMockStore = create<MockState>((set, get) => ({
  servers: [],
  statuses: {},
  logs: [],
  activeServerId: null,
  lastError: null,
  isLoaded: false,

  loadMockServers: async () => {
    const [servers, logs] = await Promise.all([
      db.mockServers.orderBy('updatedAt').reverse().toArray(),
      db.mockRequestLogs.orderBy('timestamp').reverse().limit(250).toArray(),
    ]);

    const activeServerId = get().activeServerId || servers[0]?.id || null;

    if (isTauriRuntime() && !tauriMockListenerAttached) {
      tauriMockListenerAttached = true;
      import('@tauri-apps/api/event')
        .then(({ listen }) => {
          listen<MockRequestLog>('mock://request-logged', (event) => {
            if (event.payload) {
              void get().appendLog(event.payload);
            }
          }).catch(() => {});
        })
        .catch(() => {});
    }

    set({ servers, logs, activeServerId, isLoaded: true });
  },

  selectServer: (serverId) => set({ activeServerId: serverId, lastError: null }),

  createServer: async ({ name, port, allowLanExposure = false, specId }) => {
    const now = Date.now();
    const ws = useWorkspaceStore.getState();
    const srv: MockServerConfig = {
      id: makeId('mock'),
      projectId: ws.activeProjectId,
      name: name.trim() || 'Mock Server',
      host: allowLanExposure ? '0.0.0.0' : '127.0.0.1',
      port: Number(port) || 4010,
      allowLanExposure,
      specId,
      endpoints: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.mockServers.put(srv);
    set((s) => ({
      servers: [srv, ...s.servers],
      activeServerId: srv.id,
      lastError: null,
    }));
    return srv;
  },

  updateServerConfig: async (serverId, partial) => {
    const srv = get().servers.find((s) => s.id === serverId);
    if (!srv) return;
    const updated: MockServerConfig = {
      ...srv,
      ...partial,
      host: (partial.allowLanExposure ?? srv.allowLanExposure) ? '0.0.0.0' : '127.0.0.1',
      updatedAt: Date.now(),
    };
    await db.mockServers.put(updated);
    set((s) => ({
      servers: s.servers.map((item) => (item.id === serverId ? updated : item)),
    }));
    if (get().statuses[serverId]?.running) {
      await nativeMockServerBridge.updateRoutes(updated).catch(() => {});
    }
  },

  deleteServer: async (serverId) => {
    if (get().statuses[serverId]?.running) {
      await get().stopServer(serverId);
    }
    await db.mockServers.delete(serverId);
    set((s) => {
      const remaining = s.servers.filter((item) => item.id !== serverId);
      return {
        servers: remaining,
        activeServerId: s.activeServerId === serverId ? remaining[0]?.id || null : s.activeServerId,
      };
    });
  },

  addEndpointRule: async (serverId, rule) => {
    const srv = get().servers.find((s) => s.id === serverId);
    if (!srv) return;
    const newRule: MockEndpointRule = {
      id: makeId('mep'),
      serverId,
      method: rule?.method || 'GET',
      path: rule?.path || '/example',
      enabled: rule?.enabled ?? true,
      statusCode: rule?.statusCode || 200,
      headers: rule?.headers || { 'X-Mock-Server': srv.name },
      contentType: rule?.contentType || 'application/json',
      delayMs: rule?.delayMs ?? 0,
      body: rule?.body ?? JSON.stringify({ ok: true, id: '{{$uuid}}' }, null, 2),
      description: rule?.description || 'Custom mock route',
    };
    await get().updateServerConfig(serverId, {
      endpoints: [...srv.endpoints, newRule],
    });
  },

  updateEndpointRule: async (serverId, ruleId, partial) => {
    const srv = get().servers.find((s) => s.id === serverId);
    if (!srv) return;
    const nextEndpoints = srv.endpoints.map((ep) =>
      ep.id === ruleId ? { ...ep, ...partial } : ep
    );
    await get().updateServerConfig(serverId, { endpoints: nextEndpoints });
  },

  deleteEndpointRule: async (serverId, ruleId) => {
    const srv = get().servers.find((s) => s.id === serverId);
    if (!srv) return;
    await get().updateServerConfig(serverId, {
      endpoints: srv.endpoints.filter((ep) => ep.id !== ruleId),
    });
  },

  generateFromOpenApi: async (serverId, specContent) => {
    const parsed = parseOpenApiDocument(specContent);
    const generated = generateMockEndpointsFromSpec(serverId, parsed);
    const srv = get().servers.find((s) => s.id === serverId);
    if (!srv) return 0;
    await get().updateServerConfig(serverId, {
      endpoints: [...srv.endpoints, ...generated],
    });
    return generated.length;
  },

  startServer: async (serverId) => {
    const srv = get().servers.find((s) => s.id === serverId);
    if (!srv) return;
    try {
      const status = await nativeMockServerBridge.startServer(srv);
      set((s) => ({
        statuses: { ...s.statuses, [serverId]: status },
        lastError: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start mock server';
      set({ lastError: message });
    }
  },

  stopServer: async (serverId) => {
    try {
      const status = await nativeMockServerBridge.stopServer(serverId);
      set((s) => ({
        statuses: { ...s.statuses, [serverId]: status },
        lastError: null,
      }));
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : 'Failed to stop mock server' });
    }
  },

  restartServer: async (serverId) => {
    await get().stopServer(serverId);
    await get().startServer(serverId);
  },

  simulateTestCall: async (serverId, method, pathWithQuery, requestBody = '') => {
    const srv = get().servers.find((s) => s.id === serverId);
    if (!srv) throw new Error('Mock server not found.');
    const res = simulateLocalMockDispatch(srv, method, pathWithQuery, {}, requestBody);
    await get().appendLog(res.log);
    return { status: res.status, headers: res.headers, body: res.body };
  },

  clearLogs: async (serverId) => {
    const toDelete = get().logs.filter((l) => l.serverId === serverId).map((l) => l.id);
    if (toDelete.length > 0) {
      await db.mockRequestLogs.bulkDelete(toDelete);
    }
    set((s) => ({
      logs: s.logs.filter((l) => l.serverId !== serverId),
    }));
  },

  appendLog: async (log) => {
    await db.mockRequestLogs.put(log).catch(() => {});
    set((s) => ({
      logs: [log, ...s.logs].slice(0, 250),
    }));
  },
}));
