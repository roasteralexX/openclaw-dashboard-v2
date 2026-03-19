import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n';
import styles from './GatewayEmptyState.module.css';

interface GatewayEmptyStateProps {
  illustration: React.ReactNode;
  headline: string;
  description: string;
  features: string[];
}

export default function GatewayEmptyState({
  illustration,
  headline,
  description,
  features,
}: GatewayEmptyStateProps) {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.illustration}>{illustration}</div>
        <h2 className={styles.headline}>{headline}</h2>
        <p className={styles.description}>{description}</p>
        <ul className={styles.features}>
          {features.map((f) => (
            <li key={f} className={styles.feature}>
              <span className={styles.featureDot} />
              {f}
            </li>
          ))}
        </ul>
        <button className={styles.cta} onClick={() => navigate('/settings')}>
          {t('actions.connectGateway')}
        </button>
      </div>
    </div>
  );
}
