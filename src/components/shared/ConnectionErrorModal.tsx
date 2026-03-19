import { useEffect, useState } from 'react';
import { XCircle, Wifi, ShieldX, Cpu, Network, ChevronDown, ChevronUp } from 'lucide-react';
import { useConnectionStore } from '../../store/connectionStore';
import { useI18n } from '../../hooks/useI18n';
import type { ErrorCategory } from '../../api/gatewayErrors';
import styles from './ConnectionErrorModal.module.css';

/* ── Category icon map ────────────────────────────── */

function CategoryIcon({ category }: { category: ErrorCategory }) {
  const props = { size: 16, className: styles.categoryIcon };
  switch (category) {
    case 'network':  return <Network {...props} />;
    case 'auth':     return <ShieldX {...props} />;
    case 'protocol': return <Cpu {...props} />;
    case 'server':   return <XCircle {...props} />;
  }
}

/* ── Component ────────────────────────────────────── */

interface Props {
  onClose: () => void;
}

export default function ConnectionErrorModal({ onClose }: Props) {
  const lastError    = useConnectionStore((s) => s.lastError);
  const resetCircuit = useConnectionStore((s) => s.resetCircuit);
  const clearError   = useConnectionStore((s) => s.clearError);
  const { t: tTyped } = useI18n('errors');
  const { t: tc } = useI18n('common');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = tTyped as (key: string, opts?: Record<string, unknown>) => any;

  const [showDetails, setShowDetails] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!lastError) return null;

  const { code, category, wsCode, rawReason } = lastError;

  function handleClose() {
    clearError();
    onClose();
  }

  function handleTryAgain() {
    clearError();
    onClose();
    resetCircuit();
  }

  const cause = t(`gateway.modal.${code}.cause`) as string;
  const steps = t(`gateway.modal.${code}.steps`, { returnObjects: true }) as string[];
  const categoryLabel = t(`gateway.modal.categories.${category}`) as string;

  return (
    <>
      <div className={styles.backdrop} onClick={handleClose} />

      <div
        className={`${styles.modal} anim-fade-in-up`}
        role="dialog"
        aria-modal="true"
        aria-label={t('gateway.modal.title')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <XCircle size={18} className={styles.errorIcon} />
            <span className={styles.title}>{t('gateway.modal.title')}</span>
          </div>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            title={tc('accessibility.closeModal')}
          >
            ✕
          </button>
        </div>

        {/* ── Code + category badge ── */}
        <div className={styles.codeRow}>
          <div className={styles.codeBadge}>{code}</div>
          <div className={styles.categoryBadge}>
            <CategoryIcon category={category} />
            {categoryLabel}
          </div>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>

          {/* What happened */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>{t('gateway.modal.whatHappened')}</div>
            <p className={styles.causeText}>{cause}</p>
          </div>

          {/* How to fix */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>{t('gateway.modal.howToFix')}</div>
            <ol className={styles.stepsList}>
              {Array.isArray(steps) && steps.map((step, i) => (
                <li key={i} className={styles.stepsItem}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Technical details (collapsible) */}
          <div className={styles.details}>
            <button
              className={styles.detailsToggle}
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails
                ? <><ChevronUp size={13} /> {t('gateway.modal.hideDetails')}</>
                : <><ChevronDown size={13} /> {t('gateway.modal.showDetails')}</>
              }
            </button>
            {showDetails && (
              <div className={styles.detailsGrid}>
                <span className={styles.detailKey}>{t('gateway.modal.wsCode')}</span>
                <code className={styles.detailVal}>{wsCode}</code>
                <span className={styles.detailKey}>{t('gateway.modal.rawReason')}</span>
                <code className={styles.detailVal}>{rawReason ?? '—'}</code>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={handleClose}>
            {tc('buttons.cancel')}
          </button>
          <button className={styles.btnPrimary} onClick={handleTryAgain}>
            <Wifi size={13} /> {t('gateway.modal.tryAgain')}
          </button>
        </div>
      </div>
    </>
  );
}
