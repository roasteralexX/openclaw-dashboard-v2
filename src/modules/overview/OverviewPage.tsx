import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAgentStore } from '../../store/agentStore';
import { useCronStore } from '../../store/cronStore';
import { useBoardStore } from '../../store/boardStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../hooks/useI18n';
import GatewayEmptyState from '../../components/shared/GatewayEmptyState';
import DisconnectedOverlay from '../../components/shared/DisconnectedOverlay';
import OverviewIllustration from '../../components/shared/illustrations/OverviewIllustration';
import { fmtUptime } from '../../store/healthStore';
import { AgentStatusDot } from '../../components/ui/AgentStatusDot';
import styles from './overview.module.css';

/* ── Gateway health types ───────────────────────── */
interface HealthData {
  uptime?: number;    // seconds
  version?: string;
  startedAt?: string;
  modelsCount?: number;
  nodesCount?: number;
  models?: string[];
}

export default function OverviewPage() {
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const crons = useCronStore((s) => s.crons);
  const fetchCrons = useCronStore((s) => s.fetchCrons);
  const tickets = useBoardStore((s) => s.tickets);
  const navigate = useNavigate();
  const gwStatus = useConnectionStore((s) => s.status);
  const client = useConnectionStore((s) => s.client);
  const { theme } = useTheme();
  const { t } = useI18n('dashboard');

  const isDark = theme === 'dark';
  const chartColors = {
    accent:        isDark ? '#00E5FF' : '#007A99',
    grid:          isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    tick:          isDark ? '#556677' : '#6B7A8D',
    tooltipBg:     isDark ? '#151B23' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(0,229,255,0.2)' : 'rgba(0,122,153,0.15)',
    label:         isDark ? '#8899AA' : '#6B7A8D',
  };

  const [health, setHealth] = useState<HealthData | null>(null);

  // Fetch data when gateway connection changes
  useEffect(() => {
    fetchAgents();
    fetchCrons();
  }, [gwStatus, fetchAgents, fetchCrons]);

  // Fetch health data when connected
  const fetchHealth = useCallback(async () => {
    if (gwStatus !== 'connected' || !client) {
      setHealth(null);
      return;
    }
    try {
      const [healthRes, modelsRes, nodesRes] = await Promise.allSettled([
        client.call<Record<string, unknown>>('health'),
        client.call<Record<string, unknown>>('models.list'),
        client.call<Record<string, unknown>>('node.list'),
      ]);

      const h = healthRes.status === 'fulfilled'
        ? (healthRes.value as Record<string, unknown>)
        : {};
      const mRes = modelsRes.status === 'fulfilled'
        ? (modelsRes.value as Record<string, unknown>)
        : {};
      const nRes = nodesRes.status === 'fulfilled'
        ? (nodesRes.value as Record<string, unknown>)
        : {};

      const models = Array.isArray(mRes.models) ? mRes.models as string[] : [];
      const nodes = Array.isArray(nRes.nodes) ? nRes.nodes : [];

      setHealth({
        uptime: (h.uptime ?? h.uptimeSeconds ?? 0) as number,
        version: (h.version ?? h.gatewayVersion ?? '–') as string,
        startedAt: (h.startedAt ?? '') as string,
        modelsCount: models.length || (mRes.count as number) || 0,
        nodesCount: nodes.length || (nRes.count as number) || 0,
        models: models.map((m) =>
          typeof m === 'string' ? m : (m as Record<string, unknown>).id as string ?? '?',
        ),
      });
    } catch {
      setHealth(null);
    }
  }, [gwStatus, client]);

  useEffect(() => {
    fetchHealth();
    const iv = setInterval(fetchHealth, 60_000);
    return () => clearInterval(iv);
  }, [fetchHealth]);

  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const errorAgents = agents.filter((a) => a.status === 'error').length;
  const totalTokens = agents.reduce((s, a) => s + a.tokensUsedToday, 0);
  const allExecs = crons.flatMap((c) => c.executions);
  const failedExecs = allExecs.filter((e) => e.status === 'failed').length;
  const successRate = allExecs.length > 0
    ? ((allExecs.length - failedExecs) / allExecs.length * 100).toFixed(1)
    : '100.0';
  const inProgress = tickets.filter((t) => t.column === 'in_progress').length;

  // Aggregate token history for chart
  const chartData = agents[0]?.tokenHistory.map((_, i) => {
    const date = agents[0].tokenHistory[i].date;
    const total = agents.reduce((s, a) => s + (a.tokenHistory[i]?.tokens || 0), 0);
    return { date: date.slice(5), tokens: total };
  }) || [];

  const emptyState = (
    <GatewayEmptyState
      illustration={<OverviewIllustration />}
      headline={t('emptyState.headline')}
      description={t('emptyState.description')}
      features={[
        t('emptyState.feature0'),
        t('emptyState.feature1'),
        t('emptyState.feature2'),
        t('emptyState.feature3'),
      ]}
    />
  );

  return (
    <DisconnectedOverlay connected={gwStatus === 'connected'} emptyState={emptyState}>
    <div className={styles.overview}>

      {/* Stat cards */}
      <div className={`${styles.statCard} ${errorAgents > 0 ? styles.statCardError : ''} anim-fade-in-up stagger-1`}>
        <div className={styles.statLabel}>{t('statCards.activeAgents')}</div>
        <div className={`${styles.statValue} ${styles.statAccent}`}>{activeAgents}/{agents.length}</div>
        {errorAgents > 0 && (
          <div className={`${styles.statSub} ${styles.statError}`}>
            {t('statCards.withErrors', { count: errorAgents })}
          </div>
        )}
      </div>
      <div className={`${styles.statCard} anim-fade-in-up stagger-2`}>
        <div className={styles.statLabel}>{t('statCards.tokensToday')}</div>
        <div className={`${styles.statValue} ${styles.statAccent}`}>{(totalTokens / 1000).toFixed(1)}K</div>
        <div className={styles.statSub}>{t('statCards.acrossAllAgents')}</div>
      </div>
      <div className={`${styles.statCard} anim-fade-in-up stagger-3`}>
        <div className={styles.statLabel}>{t('statCards.cronSuccessRate')}</div>
        <div className={`${styles.statValue} ${failedExecs > 0 ? styles.statWarn : styles.statSuccess}`}>{successRate}%</div>
        <div className={styles.statSub}>{t('statCards.executions', { count: allExecs.length })}</div>
      </div>
      <div className={`${styles.statCard} anim-fade-in-up stagger-4`}>
        <div className={styles.statLabel}>{t('statCards.ticketsInProgress')}</div>
        <div className={styles.statValue}>{inProgress}</div>
        <div className={styles.statSub}>{t('statCards.total', { count: tickets.length })}</div>
      </div>

      {/* Gateway Health Strip — only when connected */}
      {health && gwStatus === 'connected' && (
        <div className={`${styles.healthStrip} anim-fade-in-up`}>
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>{t('health.uptime')}</span>
            <span className={styles.healthValue}>{fmtUptime(health.uptime ?? 0)}</span>
          </div>
          <div className={styles.healthDivider} />
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>{t('health.version')}</span>
            <span className={styles.healthValue}>{health.version}</span>
          </div>
          <div className={styles.healthDivider} />
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>{t('health.model')}</span>
            <span className={styles.healthValue}>
              {health.modelsCount}
              {health.models && health.models.length > 0 && (
                <span className={styles.healthHint}>
                  {' '}({health.models.slice(0, 3).join(', ')}{health.models.length > 3 ? '…' : ''})
                </span>
              )}
            </span>
          </div>
          <div className={styles.healthDivider} />
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>{t('health.node')}</span>
            <span className={styles.healthValue}>{health.nodesCount}</span>
          </div>
        </div>
      )}

      {/* Token chart */}
      <div className={`${styles.chartSection} anim-fade-in-up stagger-5`}>
        <div className={styles.chartTitle}>{t('tokenChart.titleFull')}</div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.accent} stopOpacity={0.25} />
                <stop offset="95%" stopColor={chartColors.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis dataKey="date" tick={{ fill: chartColors.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: chartColors.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
            <Tooltip
              contentStyle={{
                background: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: chartColors.label }}
              itemStyle={{ color: chartColors.accent }}
            />
            <Area type="monotone" dataKey="tokens" stroke={chartColors.accent} fill="url(#tokenGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Agent mini cards */}
      <div className={styles.agentGrid}>
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`${styles.agentMini} anim-fade-in-up`}
            onClick={() => navigate('/agents')}
          >
            <AgentStatusDot status={agent.status} />
            <div className={styles.agentMiniInfo}>
              <div className={styles.agentMiniName}>{agent.name}</div>
              <div className={styles.agentMiniRole}>{agent.role}</div>
            </div>
            <div className={styles.agentMiniTokens}>
              {(agent.tokensUsedToday / 1000).toFixed(1)}K
            </div>
          </div>
        ))}
      </div>
    </div>
    </DisconnectedOverlay>
  );
}
