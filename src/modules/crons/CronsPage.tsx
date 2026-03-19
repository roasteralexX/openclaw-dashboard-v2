import { useEffect, useState } from 'react';
import { useCronStore } from '../../store/cronStore';
import { useAgentStore } from '../../store/agentStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useI18n } from '../../hooks/useI18n';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import GatewayEmptyState from '../../components/shared/GatewayEmptyState';
import DisconnectedOverlay from '../../components/shared/DisconnectedOverlay';
import CronsIllustration from '../../components/shared/illustrations/CronsIllustration';
import styles from './crons.module.css';


export default function CronsPage() {
  const crons = useCronStore((s) => s.crons);
  const loading = useCronStore((s) => s.loading);
  const fetchCrons = useCronStore((s) => s.fetchCrons);
  const toggleCron = useCronStore((s) => s.toggleCron);
  const runCron = useCronStore((s) => s.runCron);
  const agents = useAgentStore((s) => s.agents);
  const gwStatus = useConnectionStore((s) => s.status);
  const { t } = useI18n('crons');
  const timeAgo = useTimeAgo();

  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<{ id: string; type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    fetchCrons();
  }, [gwStatus, fetchCrons]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    setTogglingIds((s) => new Set(s).add(id));
    try {
      await toggleCron(id, !currentEnabled);
      setFlash({ id, type: 'success', msg: !currentEnabled ? t('toast.enabled') : t('toast.disabled') });
    } catch {
      setFlash({ id, type: 'error', msg: t('toast.toggleFailed') });
    } finally {
      setTogglingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const handleRun = async (id: string) => {
    setRunningIds((s) => new Set(s).add(id));
    try {
      await runCron(id);
      setFlash({ id, type: 'success', msg: t('toast.triggered') });
    } catch {
      setFlash({ id, type: 'error', msg: t('toast.runFailed') });
    } finally {
      setRunningIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const isConnected = gwStatus === 'connected';

  const emptyState = (
    <GatewayEmptyState
      illustration={<CronsIllustration />}
      headline={t('subtitle')}
      description={t('title')}
      features={[
        t('features.0'),
        t('features.1'),
        t('features.2'),
        t('features.3'),
      ]}
    />
  );

  return (
    <DisconnectedOverlay connected={isConnected} emptyState={emptyState}>
    <div className={styles.crons}>
      {loading && (
        <div className={`${styles.connectionHint} anim-fade-in-up`} style={{ color: 'var(--c-accent-500)' }}>
          ⟳ {t('loading')}
        </div>
      )}

      {crons.map((cron) => {
        const agent = agents.find((a) => a.id === cron.agentId);
        const isToggling = togglingIds.has(cron.id);
        const isRunning = runningIds.has(cron.id);
        const cronFlash = flash?.id === cron.id ? flash : null;

        return (
          <div
            key={cron.id}
            className={`${styles.cronCard} ${!cron.enabled ? styles.cronDisabled : ''} anim-fade-in-up`}
          >
            <div className={styles.cronHeader}>
              {/* Toggle switch */}
              <button
                className={`${styles.toggleDot} ${cron.enabled ? styles.toggleOn : styles.toggleOff} ${isToggling ? styles.toggling : ''}`}
                onClick={() => handleToggle(cron.id, cron.enabled)}
                disabled={!isConnected || isToggling}
                title={cron.enabled ? t('job.disabled') : t('job.enable')}
                aria-label={cron.enabled ? t('job.disabled') : t('job.enable')}
              />
              <div className={styles.cronName}>{cron.name}</div>
              <div className={styles.cronSchedule}>{cron.schedule}</div>
              {agent && <div className={styles.cronAgent}>{agent.name}</div>}

              {/* Run button */}
              <button
                className={`${styles.runBtn} ${isRunning ? styles.runBtnSpinning : ''}`}
                onClick={() => handleRun(cron.id)}
                disabled={!isConnected || isRunning || !cron.enabled}
                title={t('job.trigger')}
                aria-label={t('job.trigger')}
              >
                {isRunning ? '⟳' : '▶'}
              </button>
            </div>

            {/* Flash feedback */}
            {cronFlash && (
              <div className={`${styles.flashMsg} ${cronFlash.type === 'success' ? styles.flashSuccess : styles.flashError}`}>
                {cronFlash.type === 'success' ? '✓' : '✗'} {cronFlash.msg}
              </div>
            )}

            {/* Execution blocks */}
            <div className={styles.execTimeline}>
              {cron.executions.map((exec) => (
                <div
                  key={exec.id}
                  className={`${styles.execBlock} ${
                    exec.status === 'success' ? styles.execSuccess :
                    exec.status === 'failed' ? styles.execFailed :
                    exec.status === 'running' ? styles.execRunning :
                    styles.execScheduled
                  }`}
                  style={{ height: `${Math.min(100, Math.max(20, (exec.duration || 1) * 3))}%` }}
                  title={`${exec.status} — ${exec.duration?.toFixed(1)}s${exec.error ? `\n${exec.error}` : ''}`}
                />
              ))}
            </div>

            <div className={styles.cronMeta}>
              <span>
                <span className={styles.cronMetaLabel}>{t('job.lastRun')}: </span>
                {timeAgo(cron.lastRun)}
              </span>
              <span>
                <span className={styles.cronMetaLabel}>{t('job.runs')}: </span>
                {cron.executions.length}
              </span>
              <span>
                <span className={styles.cronMetaLabel}>{t('job.failures')}: </span>
                {cron.executions.filter((e) => e.status === 'failed').length}
              </span>
            </div>
          </div>
        );
      })}
    </div>
    </DisconnectedOverlay>
  );
}
