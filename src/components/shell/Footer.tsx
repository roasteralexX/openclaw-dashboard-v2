import { useNavigate } from 'react-router-dom';
import { useConnectionStore } from '../../store/connectionStore';
import { useI18n } from '../../hooks/useI18n';
import styles from './Footer.module.css';

export default function Footer() {
  const status = useConnectionStore((s) => s.status);
  const wsUrl = useConnectionStore((s) => s.wsUrl);
  const navigate = useNavigate();
  const { t } = useI18n();

  const isConnected = status === 'connected';

  return (
    <footer className={styles.footer}>
      {/* Left — status */}
      <div className={styles.statusGroup}>
        <span className={`${styles.dot} ${isConnected ? styles.dotConnected : styles.dotDisconnected}`} />
        <span className={`${styles.statusLabel} ${isConnected ? styles.statusLabelConnected : styles.statusLabelDisconnected}`}>
          {isConnected ? t('footer.live') : t('footer.simulation')}
        </span>
        <span className={styles.separator}>·</span>
        <span className={styles.statusMessage}>
          {isConnected ? t('footer.connectedMessage') : t('footer.disconnectedMessage')}
        </span>
      </div>

      {/* Right — url or settings CTA */}
      <div className={styles.right}>
        {isConnected ? (
          <span className={styles.urlChip}>{wsUrl}</span>
        ) : (
          <button className={styles.settingsLink} onClick={() => navigate('/settings')}>
            {t('footer.connectGateway')}
          </button>
        )}
        <span className={styles.brand}>{t('footer.brand')}</span>
      </div>
    </footer>
  );
}
