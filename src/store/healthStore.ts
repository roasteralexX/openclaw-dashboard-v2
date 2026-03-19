import { create } from 'zustand';
import { getGatewayClient } from '../api/gatewayGuard';

/* ── Types ───────────────────────────────────────── */

export interface LatencyPoint {
  ts: number;   // Unix ms timestamp
  ms: number;   // round-trip latency in ms
}

export interface MethodStats {
  method: string;
  calls: number;
  errorCount: number;
  lastErrorMsg: string | null;
  history: LatencyPoint[];  // rolling window, max MAX_HISTORY points
  avg: number;
  p95: number;
}

export interface GatewayNode {
  id: string;
  region?: string;
  model?: string;
  status: 'active' | 'degraded' | 'offline';
  load?: number;   // 0–1
  ping?: number;   // ms
}

export interface HealthSnapshot {
  status: 'healthy' | 'degraded' | 'offline';
  uptime?: number;    // seconds
  version?: string;
  startedAt?: string;
  modelsCount?: number;
  nodesCount?: number;
}

/* ── Constants ───────────────────────────────────── */

export const POLL_INTERVAL_SEC = 5;
const POLL_MS = POLL_INTERVAL_SEC * 1000;
const MAX_HISTORY = 20;

export const TRACKED_METHODS = [
  'health',
  'models.list',
  'node.list',
  'sessions.list',
  'channels.status',
];

export const METHOD_COLORS: Record<string, string> = {
  'health':          '#00E5FF',
  'models.list':     '#FFB300',
  'node.list':       '#00E676',
  'sessions.list':   '#E040FB',
  'channels.status': '#FF4081',
};

/* ── Helpers ─────────────────────────────────────── */

function calcStats(history: LatencyPoint[]): { avg: number; p95: number } {
  if (history.length === 0) return { avg: 0, p95: 0 };
  const values = [...history].map((p) => p.ms).sort((a, b) => a - b);
  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  const p95 = values[Math.max(0, Math.ceil(values.length * 0.95) - 1)];
  return { avg, p95 };
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export { fmtUptime };

/* ── Store ───────────────────────────────────────── */

interface HealthStore {
  snapshot: HealthSnapshot | null;
  methods: MethodStats[];
  nodes: GatewayNode[];
  totalCalls: number;
  isMock: boolean;
  lastPoll: number | null;
  startPolling: () => void;
  stopPolling: () => void;
}

let _pollTimer: ReturnType<typeof setInterval> | null = null;

const EMPTY_METHODS: MethodStats[] = TRACKED_METHODS.map((method) => ({
  method,
  calls: 0,
  errorCount: 0,
  lastErrorMsg: null,
  history: [],
  avg: 0,
  p95: 0,
}));

export const useHealthStore = create<HealthStore>((set, get) => {
  return {
    snapshot: null,
    methods: EMPTY_METHODS,
    nodes: [],
    totalCalls: 0,
    isMock: false,
    lastPoll: null,

    startPolling: () => {
      get().stopPolling();

      async function poll() {
        const gw = getGatewayClient();

        if (!gw) return;

        const gwClient = gw.client;
        async function timedCall(method: string): Promise<{ ok: boolean; ms: number; result: unknown }> {
          const t0 = Date.now();
          try {
            const result = await gwClient.call<unknown>(method);
            return { ok: true, ms: Date.now() - t0, result };
          } catch (err: unknown) {
            return { ok: false, ms: Date.now() - t0, result: err instanceof Error ? err.message : String(err) };
          }
        }

        const [healthRes, modelsRes, nodesRes] = await Promise.all([
          timedCall('health'),
          timedCall('models.list'),
          timedCall('node.list'),
        ]);

        const ts = Date.now();

        set((state) => {
          // Map results to tracked methods
          const resMap: Record<string, { ok: boolean; ms: number; result: unknown }> = {
            'health':      healthRes,
            'models.list': modelsRes,
            'node.list':   nodesRes,
          };

          const updatedMethods: MethodStats[] = state.methods.map((m) => {
            const res = resMap[m.method];
            if (!res) return m; // sessions.list / channels.status not polled here
            const newHistory: LatencyPoint[] = [
              ...m.history.slice(-(MAX_HISTORY - 1)),
              { ts, ms: res.ms },
            ];
            const { avg, p95 } = calcStats(newHistory);
            return {
              ...m,
              calls: m.calls + 1,
              errorCount: m.errorCount + (res.ok ? 0 : 1),
              lastErrorMsg: res.ok ? m.lastErrorMsg : String(res.result),
              history: newHistory,
              avg,
              p95,
            };
          });

          // Parse health payload
          const h = healthRes.ok ? (healthRes.result as Record<string, unknown>) : {};
          const mRes = modelsRes.ok ? (modelsRes.result as Record<string, unknown>) : {};
          const nRes = nodesRes.ok ? (nodesRes.result as Record<string, unknown>) : {};

          const models = Array.isArray(mRes?.models) ? mRes.models as unknown[] : [];
          const rawNodes = Array.isArray(nRes?.nodes) ? nRes.nodes as unknown[] : [];

          const parsedNodes: GatewayNode[] = rawNodes.map((n) => {
            const node = n as Record<string, unknown>;
            return {
              id: String(node.id ?? node.nodeId ?? 'unknown'),
              region: node.region ? String(node.region) : node.zone ? String(node.zone) : undefined,
              model: node.model ? String(node.model) : node.modelId ? String(node.modelId) : undefined,
              status: (
                node.status === 'degraded' ? 'degraded' :
                node.status === 'offline'  ? 'offline' : 'active'
              ) as GatewayNode['status'],
              load: typeof node.load === 'number' ? node.load : typeof node.cpuLoad === 'number' ? node.cpuLoad : undefined,
              ping: typeof node.ping === 'number' ? node.ping : typeof node.latencyMs === 'number' ? node.latencyMs : undefined,
            };
          });

          const activeNodes = parsedNodes.filter((n) => n.status === 'active').length;
          const hasDegraded = parsedNodes.some((n) => n.status !== 'active');
          const hasErrors = updatedMethods.some((m) => m.errorCount > 0 && resMap[m.method] && !resMap[m.method].ok);

          const snapshotStatus: HealthSnapshot['status'] =
            !healthRes.ok           ? 'offline'  :
            (hasDegraded || hasErrors) ? 'degraded' : 'healthy';

          const snapshot: HealthSnapshot = {
            status: snapshotStatus,
            uptime: (h.uptime ?? h.uptimeSeconds ?? 0) as number,
            version: (h.version ?? h.gatewayVersion ?? '–') as string,
            startedAt: (h.startedAt ?? '') as string,
            modelsCount: models.length || ((mRes.count as number) ?? 0),
            nodesCount: parsedNodes.length > 0 ? parsedNodes.length : ((nRes.count as number) ?? activeNodes),
          };

          return {
            snapshot,
            methods: updatedMethods,
            nodes: parsedNodes,
            totalCalls: updatedMethods.reduce((s, m) => s + m.calls, 0),
            isMock: false,
            lastPoll: ts,
          };
        });
      }

      poll();
      _pollTimer = setInterval(poll, POLL_MS);
    },

    stopPolling: () => {
      if (_pollTimer) {
        clearInterval(_pollTimer);
        _pollTimer = null;
      }
    },
  };
});
