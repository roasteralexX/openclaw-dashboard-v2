import { useEffect, useState } from 'react';
import { useEventStore, type GatewayEvent } from '../../store/eventStore';
import { useI18n } from '../../hooks/useI18n';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import styles from './EventFeed.module.css';

/* ── Category helpers ───────────────────────────── */

type PresenceStatus = 'active' | 'idle' | 'error' | 'offline';

function getIconInfo(event: string, payload: unknown): { icon: string; cls: string } {
  if (event.startsWith('cron.'))     return { icon: '⏱', cls: styles.iconCron };
  if (event.startsWith('sessions.')) return { icon: '⊡', cls: styles.iconSession };
  if (event.startsWith('channels.')) return { icon: '≈', cls: styles.iconChannel };
  if (event === 'system-presence') {
    const status = (payload as Record<string, unknown>)?.status as PresenceStatus | undefined;
    const cls =
      status === 'active'  ? styles.iconPresenceActive  :
      status === 'idle'    ? styles.iconPresenceIdle    :
      status === 'error'   ? styles.iconPresenceError   :
      styles.iconPresenceOffline;
    return { icon: '●', cls };
  }
  return { icon: '·', cls: styles.iconDefault };
}

function payloadPreview(payload: unknown): string {
  try {
    const str = JSON.stringify(payload);
    return str.length > 60 ? str.slice(0, 60) + '…' : str;
  } catch {
    return '';
  }
}

/* ── Timestamp ticker ───────────────────────────── */

function useNow(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

/* ── EventRow ────────────────────────────────────── */

function EventRow({ evt }: { evt: GatewayEvent }) {
  useNow();
  const timeAgo = useTimeAgo();
  const { icon, cls } = getIconInfo(evt.event, evt.payload);
  const preview = payloadPreview(evt.payload);

  return (
    <div className={styles.eventRow}>
      <div className={`${styles.eventIconWrap} ${cls}`}>{icon}</div>
      <div className={styles.eventMeta}>
        <div className={styles.eventNameRow}>
          <span className={styles.eventName}>{evt.event}</span>
          <span className={styles.eventTime}>{timeAgo(evt.timestamp)}</span>
        </div>
        {preview && (
          <div className={styles.eventPayload}>{preview}</div>
        )}
      </div>
    </div>
  );
}

/* ── EventFeed ───────────────────────────────────── */

export default function EventFeed() {
  const feedOpen    = useEventStore((s) => s.feedOpen);
  const events      = useEventStore((s) => s.events);
  const unreadCount = useEventStore((s) => s.unreadCount);
  const closeFeed   = useEventStore((s) => s.closeFeed);
  const clear       = useEventStore((s) => s.clear);
  const { t } = useI18n();

  function groupLabel(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 10)   return t('time.groups.justNow');
    if (diff < 60)   return t('time.groups.lastMinute');
    if (diff < 300)  return t('time.groups.last5Minutes');
    if (diff < 3600) return t('time.groups.lastHour');
    return t('time.groups.earlier');
  }

  function groupEvents(evts: GatewayEvent[]) {
    const groups: Array<{ label: string; items: GatewayEvent[] }> = [];
    for (const evt of evts) {
      const label = groupLabel(evt.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(evt);
      } else {
        groups.push({ label, items: [evt] });
      }
    }
    return groups;
  }

  if (!feedOpen) return null;

  const visible = events.slice(0, 100);
  const groups  = groupEvents(visible);

  return (
    <>
      {/* Invisible backdrop — click to close */}
      <div className={styles.feedBackdrop} onClick={closeFeed} />

      <aside className={styles.feed}>
        {/* Header */}
        <div className={styles.feedHeader}>
          <span className={styles.feedTitle}>{t('eventFeed.title')}</span>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge}>{unreadCount}</span>
          )}
          {events.length > 0 && (
            <button className={styles.clearBtn} onClick={clear}>
              {t('eventFeed.clear')}
            </button>
          )}
          <button
            className={styles.closeBtn}
            onClick={closeFeed}
            title={t('accessibility.closeFeed')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.feedBody}>
          {events.length === 0 ? (
            <div className={styles.emptyFeed}>
              <div className={styles.emptyIcon}>⬡</div>
              <div className={styles.emptyText}>{t('eventFeed.empty')}</div>
              <div className={styles.emptyHint}>
                {t('eventFeed.emptyHint')}
              </div>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className={styles.groupLabel}>{group.label}</div>
                {group.items.map((evt) => (
                  <EventRow key={evt.id} evt={evt} />
                ))}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
