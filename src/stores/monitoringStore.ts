import { create } from 'zustand';
import {
  AlertConfig,
  MonitorCheckResult,
  MonitorConfig,
} from '../types';
import { db } from '../database/database';
import {
  AlertDispatchEvent,
  computeMonitorSummary,
  evaluateAlertTransition,
  executeMonitorCheck,
} from '../services/monitoring/monitoringService';
import { useEnvironmentStore } from './environmentStore';
import { isTauriRuntime } from '../services/runtime/capabilities';
import { invokeDesktop } from '../services/desktop/tauriBridge';

interface MonitoringState {
  monitors: MonitorConfig[];
  results: MonitorCheckResult[];
  alertConfigs: AlertConfig[];
  alertEvents: AlertDispatchEvent[];
  checkingMonitorIds: Record<string, boolean>;
  browserTimers: Record<string, ReturnType<typeof setInterval>>;

  loadMonitors: () => Promise<void>;
  saveMonitor: (monitor: MonitorConfig, alertConfig?: AlertConfig) => Promise<void>;
  deleteMonitor: (monitorId: string) => Promise<void>;
  toggleMonitorEnabled: (monitorId: string, enabled: boolean) => Promise<void>;
  toggleMonitorPaused: (monitorId: string, paused: boolean) => Promise<void>;
  runManualCheck: (monitorId: string) => Promise<MonitorCheckResult | null>;
  startSchedulerForMonitor: (monitorId: string) => Promise<void>;
  stopSchedulerForMonitor: (monitorId: string) => Promise<void>;
  clearAlerts: () => void;
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  monitors: [],
  results: [],
  alertConfigs: [],
  alertEvents: [],
  checkingMonitorIds: {},
  browserTimers: {},

  loadMonitors: async () => {
    const [monitors, results, alertConfigs] = await Promise.all([
      db.monitoringConfigs.orderBy('updatedAt').reverse().toArray(),
      db.monitoringResults.orderBy('timestamp').reverse().toArray(),
      db.alertConfigs.orderBy('updatedAt').reverse().toArray(),
    ]);
    set({ monitors, results, alertConfigs });
  },

  saveMonitor: async (monitor, alertConfig) => {
    const savedMon = { ...monitor, updatedAt: Date.now() };
    await db.monitoringConfigs.put(savedMon);
    if (alertConfig) {
      await db.alertConfigs.put({ ...alertConfig, updatedAt: Date.now() });
    }
    await get().loadMonitors();
  },

  deleteMonitor: async (monitorId) => {
    await get().stopSchedulerForMonitor(monitorId);
    await db.monitoringConfigs.delete(monitorId);
    await db.monitoringResults.where('monitorId').equals(monitorId).delete();
    await db.alertConfigs.where('monitorId').equals(monitorId).delete();
    set((s) => ({
      monitors: s.monitors.filter((m) => m.id !== monitorId),
      results: s.results.filter((r) => r.monitorId !== monitorId),
      alertConfigs: s.alertConfigs.filter((a) => a.monitorId !== monitorId),
    }));
  },

  toggleMonitorEnabled: async (monitorId, enabled) => {
    const target = get().monitors.find((m) => m.id === monitorId);
    if (!target) return;
    const updated = { ...target, enabled, updatedAt: Date.now() };
    await db.monitoringConfigs.put(updated);
    if (enabled && !updated.paused) {
      await get().startSchedulerForMonitor(monitorId);
    } else {
      await get().stopSchedulerForMonitor(monitorId);
    }
    await get().loadMonitors();
  },

  toggleMonitorPaused: async (monitorId, paused) => {
    const target = get().monitors.find((m) => m.id === monitorId);
    if (!target) return;
    const updated = { ...target, paused, updatedAt: Date.now() };
    await db.monitoringConfigs.put(updated);
    if (paused) {
      await get().stopSchedulerForMonitor(monitorId);
    } else if (updated.enabled) {
      await get().startSchedulerForMonitor(monitorId);
    }
    await get().loadMonitors();
  },

  runManualCheck: async (monitorId) => {
    const monitor = get().monitors.find((m) => m.id === monitorId);
    if (!monitor) return null;

    set((s) => ({
      checkingMonitorIds: { ...s.checkingMonitorIds, [monitorId]: true },
    }));

    try {
      const prevSummary = computeMonitorSummary(monitorId, get().results);
      const vars = useEnvironmentStore.getState().getResolvedVariables();
      const result = await executeMonitorCheck(monitor, vars);
      await db.monitoringResults.put(result);

      const alertConfig = get().alertConfigs.find((a) => a.monitorId === monitorId);
      const alertEv = evaluateAlertTransition({
        monitor,
        previousStatus: prevSummary.currentStatus,
        result,
        alertConfig,
      });

      if (alertEv && alertConfig?.webhookEnabled && alertConfig.webhookUrl && isTauriRuntime()) {
        await invokeDesktop<number>('monitor_dispatch_webhook', {
          webhookUrl: alertConfig.webhookUrl,
          secretRef: alertConfig.webhookSecretRef ?? null,
          payload: alertEv,
        }).catch(() => {});
      }

      if (
        alertEv &&
        alertConfig?.desktopNotification &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification('API Studio Monitor Alert', { body: alertEv.message });
      }

      set((s) => ({
        results: [result, ...s.results].slice(0, 500),
        alertEvents: alertEv ? [alertEv, ...s.alertEvents].slice(0, 50) : s.alertEvents,
        checkingMonitorIds: { ...s.checkingMonitorIds, [monitorId]: false },
      }));
      return result;
    } catch {
      set((s) => ({
        checkingMonitorIds: { ...s.checkingMonitorIds, [monitorId]: false },
      }));
      return null;
    }
  },

  startSchedulerForMonitor: async (monitorId) => {
    const monitor = get().monitors.find((m) => m.id === monitorId);
    if (!monitor) return;
    await get().stopSchedulerForMonitor(monitorId);

    const intervalMs = Math.max(10_000, monitor.intervalSeconds * 1000);
    const timer = setInterval(() => {
      const latest = get().monitors.find((m) => m.id === monitorId);
      if (latest && latest.enabled && !latest.paused) {
        void get().runManualCheck(monitorId);
      }
    }, intervalMs);

    set((s) => ({
      browserTimers: { ...s.browserTimers, [monitorId]: timer },
    }));
  },

  stopSchedulerForMonitor: async (monitorId) => {
    const existing = get().browserTimers[monitorId];
    if (existing) {
      clearInterval(existing);
      set((s) => {
        const next = { ...s.browserTimers };
        delete next[monitorId];
        return { browserTimers: next };
      });
    }
    if (isTauriRuntime()) {
      await invokeDesktop<boolean>('monitor_stop_background', { monitorId }).catch(() => {});
    }
  },

  clearAlerts: () => set({ alertEvents: [] }),
}));
