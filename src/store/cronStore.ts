import { create } from 'zustand';
import type { CronJob, CronExecution } from '../types';
import { getGatewayClient } from '../api/gatewayGuard';
import { useAuditStore } from './auditStore';
import { validateCronId } from '../api/validation';

interface CronStore {
  crons: CronJob[];
  loading: boolean;
  selectedCronId: string | null;
  selectCron: (id: string | null) => void;
  fetchCrons: () => Promise<void>;
  toggleCron: (id: string, enabled: boolean) => Promise<void>;
  runCron: (id: string) => Promise<void>;
  fetchHistory: (id: string) => Promise<CronExecution[]>;
}

/**
 * Maps OpenClaw `cron.list` response to our CronJob type.
 */
function mapGatewayCron(gc: Record<string, unknown>, idx: number): CronJob {
  const id = (gc.id ?? `cron-${idx}`) as string;
  const history = (gc.history ?? []) as Record<string, unknown>[];

  return {
    id,
    name: (gc.label ?? gc.prompt?.toString().slice(0, 40) ?? id) as string,
    schedule: (gc.expression ?? gc.schedule ?? '* * * * *') as string,
    agentId: (gc.agent ?? gc.delivery ?? '') as string,
    description: (gc.prompt ?? '') as string,
    enabled: (gc.enabled ?? true) as boolean,
    lastRun: (gc.lastRun ?? '') as string,
    nextRun: (gc.nextRun ?? '') as string,
    executions: history.map((h, hi) => ({
      id: (h.id ?? `run-${hi}`) as string,
      startTime: (h.startedAt ?? h.startTime ?? '') as string,
      endTime: (h.completedAt ?? h.endTime ?? undefined) as string | undefined,
      status: (h.status ?? 'success') as CronExecution['status'],
      duration: (h.duration ?? undefined) as number | undefined,
      error: (h.error ?? undefined) as string | undefined,
    })),
  };
}

export const useCronStore = create<CronStore>((set) => ({
  crons: [],
  loading: false,
  selectedCronId: null,
  selectCron: (id) => set({ selectedCronId: id }),

  fetchCrons: async () => {
    const gw = getGatewayClient();
    if (!gw) return;

    set({ loading: true });
    try {
      const res = await gw.client.call<Record<string, unknown>>('cron.list');
      const items = (res as Record<string, unknown>)?.crons
        ?? (Array.isArray(res) ? res : []);

      const crons = (items as Record<string, unknown>[]).map(mapGatewayCron);
      set({ crons, loading: false });
    } catch (err) {
      console.warn('[CronStore] Failed to fetch from gateway:', err);
      set({ crons: [], loading: false });
    }
  },

  toggleCron: async (id, enabled) => {
    if (!validateCronId(id).ok) {
      console.warn('[CronStore] Invalid cron id rejected:', id);
      return;
    }
    const gw = getGatewayClient();
    if (!gw) return;

    try {
      await gw.client.call(enabled ? 'cron.enable' : 'cron.disable', { id });
      useAuditStore.getState().log('cron.toggle', `id:${id} enabled:${enabled}`);
      // Optimistic update
      set((s) => ({
        crons: s.crons.map((c) => (c.id === id ? { ...c, enabled } : c)),
      }));
    } catch (err) {
      console.warn('[CronStore] Toggle failed:', err);
    }
  },

  runCron: async (id) => {
    if (!validateCronId(id).ok) {
      console.warn('[CronStore] Invalid cron id rejected:', id);
      return;
    }
    const gw = getGatewayClient();
    if (!gw) return;

    try {
      await gw.client.call('cron.run', { id });
      useAuditStore.getState().log('cron.run', `id:${id}`);
    } catch (err) {
      console.warn('[CronStore] Run failed:', err);
    }
  },

  fetchHistory: async (id) => {
    const gw = getGatewayClient();
    if (!gw) return [];

    try {
      const res = await gw.client.call<{ runs?: Record<string, unknown>[] }>('cron.history', { id });
      const runs = (res as Record<string, unknown>)?.runs ?? [];
      return (runs as Record<string, unknown>[]).map((h, i) => ({
        id: (h.id ?? `run-${i}`) as string,
        startTime: (h.startedAt ?? '') as string,
        endTime: (h.completedAt ?? undefined) as string | undefined,
        status: (h.status ?? 'success') as CronExecution['status'],
        duration: (h.duration ?? undefined) as number | undefined,
        error: (h.error ?? undefined) as string | undefined,
      }));
    } catch {
      return [];
    }
  },
}));
