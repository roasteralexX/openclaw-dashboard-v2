import { useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useHealthStore, METHOD_COLORS, TRACKED_METHODS, POLL_INTERVAL_SEC, fmtUptime } from '../../store/healthStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useI18n } from '../../hooks/useI18n';
import GatewayEmptyState from '../../components/shared/GatewayEmptyState';
import HealthIllustration from '../../components/shared/illustrations/HealthIllustration';
import styles from './health.module.css';

/* ── Tooltip ────────────────────────────────────── */

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--c-surface-2)',
      border: '1px solid var(--c-border)',
      borderRadius: 4,
      padding: '6px 10px',
      fontFamily: 'var(--ff-mono)',
      fontSize: 11,
    }}>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.7 }}>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.value}ms</span>
        </div>
      ))}
    </div>
  );
}

/* ── Page ───────────────────────────────────────── */

export default function HealthPage() {
  const snapshot    = useHealthStore((s) => s.snapshot);
  const methods     = useHealthStore((s) => s.methods);
  const nodes       = useHealthStore((s) => s.nodes);
  const totalCalls  = useHealthStore((s) => s.totalCalls);
  const startPolling = useHealthStore((s) => s.startPolling);
  const stopPolling  = useHealthStore((s) => s.stopPolling);
  const gwStatus    = useConnectionStore((s) => s.status);
  const { t } = useI18n('health');

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [gwStatus, startPolling, stopPolling]);

  /* ── Derived metrics ── */
  const polledMethods = methods.filter((m) => ['health', 'models.list', 'node.list'].includes(m.method));
  const overallAvg = polledMethods.length > 0
    ? Math.round(polledMethods.reduce((s, m) => s + m.avg, 0) / polledMethods.length)
    : 0;
  const totalErrors = methods.reduce((s, m) => s + m.errorCount, 0);
  const totalTrackedCalls = methods.reduce((s, m) => s + m.calls, 0);
  const errorRate = totalTrackedCalls > 0
    ? ((totalErrors / totalTrackedCalls) * 100).toFixed(1)
    : '0.0';
  const activeNodeCount = nodes.filter((n) => n.status === 'active').length;

  /* ── Latency chart data ── */
  // Build unified timeline from all methods' history
  const allTs = Array.from(
    new Set(methods.flatMap((m) => m.history.map((p) => p.ts))),
  ).sort((a, b) => a - b);

  const chartData = allTs.slice(-MAX_CHART_POINTS).map((ts) => {
    const point: Record<string, number | string> = {
      t: formatTs(ts),
    };
    for (const m of methods) {
      const match = m.history.find((p) => p.ts === ts);
      if (match) point[m.method] = match.ms;
    }
    return point;
  });

  /* ── Badge ── */
  function getBadgeClass() {
    if (!snapshot || snapshot.status === 'offline') return styles.badgeOffline;
    if (snapshot.status === 'healthy')  return styles.badgeHealthy;
    if (snapshot.status === 'degraded') return styles.badgeDegraded;
    return styles.badgeOffline;
  }

  function getBadgeText() {
    if (!snapshot) return t('badge.offline');
    return t(`badge.${snapshot.status}`);
  }

  const badgePulse = snapshot?.status === 'healthy';

  /* ── Empty state: no data yet (never connected) ── */
  if (snapshot === null) {
    return (
      <GatewayEmptyState
        illustration={<HealthIllustration />}
        headline={t('empty.headline')}
        description={t('empty.description')}
        features={[
          t('features.0'),
          t('features.1'),
          t('features.2'),
          t('features.3'),
        ]}
      />
    );
  }

  return (
    <div className={`${styles.page} anim-fade-in-up`}>

      {/* ── Status bar ── */}
      <div className={styles.statusBar}>
        <span className={`${styles.badge} ${getBadgeClass()}`}>
          <span className={`${styles.badgeDot} ${badgePulse ? styles.badgeDotPulse : ''}`} />
          {getBadgeText()}
        </span>

        <div className={styles.statusMeta}>
          {snapshot.version && (
            <span className={styles.statusMetaItem}>
              <span className={styles.statusMetaLabel}>{t('info.version')}</span>
              {' '}{snapshot.version}
            </span>
          )}
          {snapshot.uptime != null && snapshot.uptime > 0 && (
            <span className={styles.statusMetaItem}>
              <span className={styles.statusMetaLabel}>{t('info.uptime')}</span>
              {' '}{fmtUptime(snapshot.uptime)}
            </span>
          )}
          {snapshot.modelsCount != null && snapshot.modelsCount > 0 && (
            <span className={styles.statusMetaItem}>
              <span className={styles.statusMetaLabel}>{t('info.models')}</span>
              {' '}{snapshot.modelsCount}
            </span>
          )}
          {snapshot.nodesCount != null && snapshot.nodesCount > 0 && (
            <span className={styles.statusMetaItem}>
              <span className={styles.statusMetaLabel}>{t('info.nodes')}</span>
              {' '}{snapshot.nodesCount}
            </span>
          )}
        </div>

        <span className={styles.pollIndicator}>
          {t('poll.live', { interval: POLL_INTERVAL_SEC })}
        </span>
      </div>

      {/* ── KPI cards ── */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard} style={{ '--kpi-accent': '#00E5FF' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{totalCalls.toLocaleString()}</div>
          <div className={styles.kpiLabel}>{t('kpi.totalCalls')}</div>
        </div>

        <div className={styles.kpiCard} style={{ '--kpi-accent': '#FFB300' } as React.CSSProperties}>
          <div className={styles.kpiValue}>
            {overallAvg}
            <span className={styles.kpiValueUnit}>{t('kpi.ms')}</span>
          </div>
          <div className={styles.kpiLabel}>{t('kpi.avgLatency')}</div>
        </div>

        <div
          className={`${styles.kpiCard} ${parseFloat(errorRate) > 0 ? styles.kpiDegraded : ''}`}
          style={{ '--kpi-accent': parseFloat(errorRate) > 0 ? '#FFB300' : '#00E676' } as React.CSSProperties}
        >
          <div className={styles.kpiValue}>
            {errorRate}
            <span className={styles.kpiValueUnit}>{t('kpi.pct')}</span>
          </div>
          <div className={styles.kpiLabel}>{t('kpi.errorRate')}</div>
        </div>

        <div
          className={`${styles.kpiCard} ${activeNodeCount === 0 ? styles.kpiDegraded : ''}`}
          style={{ '--kpi-accent': activeNodeCount > 0 ? '#00E676' : '#FF5252' } as React.CSSProperties}
        >
          <div className={styles.kpiValue}>{activeNodeCount}</div>
          <div className={styles.kpiLabel}>{t('kpi.activeNodes')}</div>
        </div>
      </div>

      {/* ── Chart + Nodes ── */}
      <div className={styles.mainGrid}>

        {/* Latency Chart */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>{t('latencyChart.title')}</span>
          </div>
          <div className={styles.cardBody}>
            {chartData.length < 2 ? (
              <div className={styles.chartEmpty}>{t('latencyChart.noData')}</div>
            ) : (
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                    />
                    <XAxis
                      dataKey="t"
                      tick={{ fontSize: 10, fontFamily: 'var(--ff-mono)', fill: 'var(--c-text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fontFamily: 'var(--ff-mono)', fill: 'var(--c-text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      unit="ms"
                      width={46}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {TRACKED_METHODS.map((method) => (
                      <Line
                        key={method}
                        type="monotone"
                        dataKey={method}
                        name={method}
                        stroke={METHOD_COLORS[method]}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Legend */}
          <div className={styles.chartLegend}>
            {TRACKED_METHODS.map((m) => (
              <span key={m} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: METHOD_COLORS[m] }} />
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Node Health */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>{t('nodes.title')}</span>
          </div>
          <div className={styles.cardBody}>
            {nodes.length === 0 ? (
              <div className={styles.nodeEmpty}>{t('nodes.empty')}</div>
            ) : (
              <div className={styles.nodeList}>
                {nodes.map((node) => {
                  const loadPct = node.load != null ? Math.round(node.load * 100) : null;
                  const loadClass =
                    node.load == null     ? '' :
                    node.load > 0.85      ? styles.nodeLoadCritical :
                    node.load > 0.65      ? styles.nodeLoadWarn :
                    styles.nodeLoadNormal;
                  const dotClass =
                    node.status === 'degraded' ? styles.nodeStatusDegraded :
                    node.status === 'offline'  ? styles.nodeStatusOffline  :
                    styles.nodeStatusActive;
                  const cardClass =
                    node.status === 'degraded' ? styles.nodeCardDegraded :
                    node.status === 'offline'  ? styles.nodeCardOffline  :
                    '';
                  return (
                    <div key={node.id} className={`${styles.nodeCard} ${cardClass}`}>
                      <div className={styles.nodeHeader}>
                        <span className={`${styles.nodeStatusDot} ${dotClass}`} />
                        <span className={styles.nodeId}>{node.id}</span>
                        {node.ping != null && (
                          <span className={styles.nodePing}>{node.ping}ms</span>
                        )}
                      </div>
                      {(node.region || node.model) && (
                        <div className={styles.nodeMeta}>
                          {node.region && <span>{node.region}</span>}
                          {node.region && node.model && <span> · </span>}
                          {node.model && <span>{node.model}</span>}
                        </div>
                      )}
                      {loadPct != null && (
                        <div className={styles.nodeLoadWrap}>
                          <div className={styles.nodeLoadBar}>
                            <div
                              className={`${styles.nodeLoadFill} ${loadClass}`}
                              style={{ width: `${loadPct}%` }}
                            />
                          </div>
                          <span className={styles.nodeLoadPct}>{loadPct}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RPC Method Stats table ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>{t('rpc.title')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.methodTable}>
            <thead>
              <tr>
                <th>{t('rpc.method')}</th>
                <th>{t('rpc.calls')}</th>
                <th>{t('rpc.avgMs')}</th>
                <th>{t('rpc.p95Ms')}</th>
                <th>{t('rpc.errors')}</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.method} className={m.errorCount > 0 ? styles.methodErrorRow : ''}>
                  <td>
                    <span
                      className={styles.methodName}
                      style={{ color: METHOD_COLORS[m.method] ?? 'var(--c-accent-500)' }}
                    >
                      {m.method}
                    </span>
                  </td>
                  <td>{m.calls.toLocaleString()}</td>
                  <td>{m.avg > 0 ? `${m.avg}ms` : '—'}</td>
                  <td>{m.p95 > 0 ? `${m.p95}ms` : '—'}</td>
                  <td>
                    <span className={m.errorCount > 0 ? styles.methodErrors : ''}>
                      {m.errorCount}
                    </span>
                    {m.lastErrorMsg && m.errorCount > 0 && (
                      <div className={styles.methodErrorMsg}
                           title={t('rpc.lastError', { msg: m.lastErrorMsg })}>
                        {m.lastErrorMsg}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

/* ── Helpers ─────────────────────────────────────── */

const MAX_CHART_POINTS = 20;

function formatTs(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
