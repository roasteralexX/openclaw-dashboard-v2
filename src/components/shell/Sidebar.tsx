import { NavLink, useLocation } from 'react-router-dom';
import {
  Bot,
  Clock,
  Building2,
  LayoutDashboard,
  Settings,
  BarChart3,
  Activity,
  MessageSquare,
  Lock,
  LockOpen,
  ShieldAlert,
} from 'lucide-react';
import { useConnectionStore } from '../../store/connectionStore';
import { useEventStore } from '../../store/eventStore';
import { useAgentStore } from '../../store/agentStore';
import { useI18n } from '../../hooks/useI18n';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const location = useLocation();
  const gwStatus = useConnectionStore((s) => s.status);
  const wsUrl = useConnectionStore((s) => s.wsUrl);
  const transportMode = useConnectionStore((s) => s.transportMode);
  const resetCircuit = useConnectionStore((s) => s.resetCircuit);
  const isActive = useEventStore((s) => s.isActive);
  const unreadCount = useEventStore((s) => s.unreadCount);
  const toggleFeed = useEventStore((s) => s.toggleFeed);
  const agentCount = useAgentStore((s) => s.agents.length);
  const { t } = useI18n();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.overview') },
    { to: '/agents', icon: Bot, label: t('nav.agents'), dynamicBadge: true },
    { to: '/chat',   icon: MessageSquare, label: t('nav.chat') },
    { to: '/crons', icon: Clock, label: t('nav.crons') },
    { to: '/office', icon: Building2, label: t('nav.office') },
    { to: '/board', icon: BarChart3, label: t('nav.board') },
    { to: '/health', icon: Activity, label: t('nav.health') },
  ];

  const statusLabel =
    gwStatus === 'connected'
      ? `${t('status.connected')} — ${new URL(wsUrl).host}`
      : gwStatus === 'connecting'
      ? t('status.connecting')
      : gwStatus === 'suspended'
      ? t('status.suspended')
      : gwStatus === 'error'
      ? t('sidebar.connectionError')
      : t('status.disconnected');

  const dotClass =
    gwStatus === 'connected'
      ? styles.dotConnected
      : gwStatus === 'error'
      ? styles.dotError
      : gwStatus === 'connecting'
      ? styles.dotConnecting
      : gwStatus === 'suspended'
      ? styles.dotSuspended
      : styles.dotDisconnected;

  const mode = transportMode();
  const SecurityIcon = mode === 'secure' ? Lock : mode === 'local' ? LockOpen : ShieldAlert;
  const securityIconClass =
    mode === 'secure' ? styles.iconSecure :
    mode === 'local'  ? styles.iconLocal  :
    styles.iconInsecure;
  const securityTitle =
    mode === 'secure' ? t('sidebar.secureConnection') :
    mode === 'local'  ? t('sidebar.localConnection')  :
    t('sidebar.insecureConnection');

  const eventsLabel = unreadCount > 0
    ? t('sidebar.eventsUnread', { count: unreadCount })
    : t('sidebar.events');

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>⬡</div>
        <div>
          <div className={styles.logoText}>OpenClaw</div>
          <div className={styles.logoSub}>Command Center</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.sectionLabel}>{t('sidebar.modules')}</div>
        {navItems.map(({ to, icon: Icon, label, dynamicBadge }) => {
          const isCurrentActive =
            to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          const badge = dynamicBadge ? String(agentCount) : undefined;
          return (
            <NavLink
              key={to}
              to={to}
              className={`${styles.navLink} ${isCurrentActive ? styles.navLinkActive : ''}`}
            >
              <Icon className={styles.navIcon} size={20} />
              {label}
              {badge && <span className={styles.badge}>{badge}</span>}
            </NavLink>
          );
        })}

        <div className={styles.sectionLabel}>{t('sidebar.system')}</div>
        <NavLink
          to="/settings"
          className={`${styles.navLink} ${
            location.pathname === '/settings' ? styles.navLinkActive : ''
          }`}
        >
          <Settings className={styles.navIcon} size={20} />
          {t('nav.settings')}
        </NavLink>
      </nav>

      {/* Event Activity + Connection Status */}
      <div className={styles.sidebarFooter}>
        {/* Event pulse indicator */}
        {gwStatus === 'connected' && (
          <div
            className={`${styles.eventIndicator} ${styles.eventClickable} ${isActive ? styles.eventPulse : ''}`}
            onClick={toggleFeed}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && toggleFeed()}
            title={t('sidebar.openEventFeed')}
          >
            <span className={styles.eventDot} />
            <span className={styles.eventLabel}>{eventsLabel}</span>
          </div>
        )}

        {/* Connection status */}
        <div className={styles.connectionStatus}>
          <span className={`${styles.dot} ${dotClass}`} />
          {statusLabel}
          <span title={securityTitle} style={{ display: 'contents' }}>
            <SecurityIcon
              size={12}
              className={`${styles.securityIcon} ${securityIconClass}`}
              aria-label={securityTitle}
            />
          </span>
        </div>

        {/* Resume button when circuit breaker tripped */}
        {gwStatus === 'suspended' && (
          <button className={styles.resumeBtn} onClick={resetCircuit}>
            {t('sidebar.resumeConnection')}
          </button>
        )}
      </div>
    </aside>
  );
}
