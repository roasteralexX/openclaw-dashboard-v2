import { useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Wifi, WifiOff, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useConnectionStore } from '../../store/connectionStore';
import { useAuditStore } from '../../store/auditStore';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import ConnectionErrorModal from '../../components/shared/ConnectionErrorModal';
import styles from './settings.module.css';

/* ── Page ────────────────────────────────────────── */

export default function SettingsPage() {
  const wsUrl         = useConnectionStore((s) => s.wsUrl);
  const authToken     = useConnectionStore((s) => s.authToken);
  const tlsFingerprint = useConnectionStore((s) => s.tlsFingerprint);
  const status        = useConnectionStore((s) => s.status);
  const error         = useConnectionStore((s) => s.error);
  const lastError     = useConnectionStore((s) => s.lastError);
  const gatewayInfo   = useConnectionStore((s) => s.gatewayInfo);
  const setConfig     = useConnectionStore((s) => s.setConfig);
  const connect       = useConnectionStore((s) => s.connect);
  const disconnect    = useConnectionStore((s) => s.disconnect);
  const resetCircuit  = useConnectionStore((s) => s.resetCircuit);
  const transportMode = useConnectionStore((s) => s.transportMode);
  const auditEntries  = useAuditStore((s) => s.entries);
  const auditLog      = useAuditStore((s) => s.log);
  const auditClear    = useAuditStore((s) => s.clear);
  const { t } = useI18n('settings');
  const { t: tc } = useI18n('common');

  const [localUrl,   setLocalUrl]   = useState(wsUrl);
  const [localToken, setLocalToken] = useState(authToken);
  const [localTlsFp, setLocalTlsFp] = useState(tlsFingerprint);
  const [urlError,   setUrlError]   = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showGuide,      setShowGuide]      = useState(status !== 'connected');
  const [breakGlass,     setBreakGlass]     = useState(false);
  const [showAudit,      setShowAudit]      = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const toast = useToast();

  // Auto-open error modal whenever a new gateway error is diagnosed
  useEffect(() => {
    if (lastError) {
      setErrorModalOpen(true);
    }
  }, [lastError]);

  const isInsecure = transportMode() === 'insecure';

  /* ── Validation (uses translated messages) ── */
  function validateUrl(url: string): string | null {
    if (!url.trim()) return t('validation.urlRequired');
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      return t('validation.urlInvalid');
    }
    try { new URL(url); } catch { return t('validation.urlBadFormat'); }
    return null;
  }

  function validateToken(token: string): string | null {
    if (!token.trim()) return t('validation.tokenRequired');
    if (token.trim().length < 32) return t('validation.tokenShort');
    return null;
  }

  const validate = useCallback(() => {
    const ue = validateUrl(localUrl);
    const te = validateToken(localToken);
    setUrlError(ue);
    setTokenError(te);
    return !ue && !te;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localUrl, localToken, t]);

  function handleSave() {
    if (!validate()) return;
    setConfig(localUrl, localToken, localTlsFp || undefined);
    toast.success(t('toast.saved'));
  }

  function handleConnect() {
    if (!validate()) return;
    setConfig(localUrl, localToken, localTlsFp || undefined);
    connect();
  }

  function handleDisconnect() {
    disconnect();
  }

  const SETUP_STEPS = [
    { n: '1', title: t('guide.steps.0.title'), desc: t('guide.steps.0.desc'), code: t('guide.steps.0.code') },
    { n: '2', title: t('guide.steps.1.title'), desc: t('guide.steps.1.desc'), code: t('guide.steps.1.code') },
    { n: '3', title: t('guide.steps.2.title'), desc: t('guide.steps.2.desc'), code: null },
  ];

  const protocol = (gatewayInfo as Record<string, unknown>)?.protocol;
  const policy   = (gatewayInfo as Record<string, unknown>)?.policy as Record<string, unknown> | undefined;
  const version  = (gatewayInfo as Record<string, unknown>)?.version as string | undefined;
  const nodeId   = (gatewayInfo as Record<string, unknown>)?.nodeId as string | undefined;

  return (
    <div className={styles.settings}>

      {/* ── Onboarding banner (disconnected) ── */}
      {status !== 'connected' && (
        <div className={`${styles.section} ${styles.onboardingSection} anim-fade-in-up`}>
          <div className={styles.onboardingIcon}>⬡</div>
          <div className={styles.onboardingHeadline}>{t('onboarding.headline')}</div>
          <div className={styles.onboardingDesc}>{t('onboarding.desc')}</div>

          <button
            className={styles.guideToggle}
            onClick={() => setShowGuide((v) => !v)}
          >
            {showGuide ? t('guide.toggle.hide') : t('guide.toggle.show')}
          </button>

          {showGuide && (
            <div className={`${styles.setupGuide} anim-fade-in-up`}>
              {SETUP_STEPS.map((step) => (
                <div key={step.n} className={styles.setupStep}>
                  <div className={styles.setupStepNum}>{step.n}</div>
                  <div className={styles.setupStepBody}>
                    <div className={styles.setupStepTitle}>{step.title}</div>
                    <div className={styles.setupStepDesc}>{step.desc}</div>
                    {step.code && (
                      <div className={styles.setupCode}>{step.code}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Gateway Connection ── */}
      <div className={`${styles.section} anim-fade-in-up`}>
        <div className={styles.sectionTitle}>{t('gateway.title')}</div>

        {/* URL field */}
        <div className={styles.field}>
          <label className={styles.label}>{t('gateway.urlLabel')}</label>
          <input
            className={`${styles.input} ${urlError ? styles.inputError : ''}`}
            value={localUrl}
            onChange={(e) => { setLocalUrl(e.target.value); setUrlError(null); }}
            onBlur={() => setUrlError(validateUrl(localUrl))}
            placeholder={t('gateway.urlPlaceholder')}
          />
          {urlError && <div className={styles.fieldError}>{urlError}</div>}
        </div>

        {/* Token field */}
        <div className={styles.field}>
          <label className={styles.label}>{t('gateway.tokenLabel')}</label>
          <input
            className={`${styles.input} ${tokenError ? styles.inputError : ''}`}
            type="password"
            value={localToken}
            onChange={(e) => { setLocalToken(e.target.value); setTokenError(null); }}
            onBlur={() => setTokenError(validateToken(localToken))}
            placeholder={t('gateway.tokenPlaceholder')}
          />
          {tokenError && <div className={styles.fieldError}>{tokenError}</div>}
          <div className={styles.tokenHint}>
            {t('gateway.tokenHint')}
          </div>
        </div>

        {/* TLS fingerprint (optional) */}
        <div className={styles.field}>
          <label className={styles.label}>{t('security.tlsFingerprintLabel')}</label>
          <input
            className={styles.input}
            value={localTlsFp}
            onChange={(e) => setLocalTlsFp(e.target.value)}
            placeholder="sha256/..."
          />
          <div className={styles.tokenHint}>{t('security.tlsFingerprintHint')}</div>
        </div>

        {/* Security banner (insecure transport) */}
        {isInsecure && (
          <div className={styles.securityBanner}>
            <ShieldAlert size={14} className={styles.securityBannerIcon} />
            <div>
              {t('security.insecureWarning')}
              <label className={styles.breakGlassRow}>
                <input
                  type="checkbox"
                  checked={breakGlass}
                  onChange={(e) => {
                    setBreakGlass(e.target.checked);
                    if (e.target.checked) {
                      auditLog('connect', 'Break-glass insecure override acknowledged', { wsUrl: localUrl });
                    }
                  }}
                />
                {t('security.breakGlassAck')}
              </label>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className={styles.btnRow}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            {tc('buttons.save')}
          </button>
          {status === 'connected' ? (
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnDanger}`} onClick={handleDisconnect}>
              <WifiOff size={14} /> {tc('buttons.disconnect')}
            </button>
          ) : status === 'suspended' ? (
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={resetCircuit}>
              <Wifi size={14} /> {tc('sidebar.resumeConnection')}
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={handleConnect}
              disabled={status === 'connecting' || (isInsecure && !breakGlass)}
            >
              {status === 'connecting'
                ? <><Loader2 size={14} className="anim-spin" /> {tc('status.connecting')}</>
                : <><Wifi size={14} /> {tc('buttons.connect')}</>
              }
            </button>
          )}
        </div>

        {/* Connection status strip */}
        <div className={`${styles.statusStrip} ${
          status === 'connected'   ? styles.statusStripConnected   :
          status === 'error'       ? styles.statusStripError       :
          status === 'connecting'  ? styles.statusStripConnecting  :
          status === 'suspended'   ? styles.statusStripSuspended   :
          styles.statusStripIdle
        }`}>
          {status === 'connected' && (
            <><CheckCircle size={14} /> {tc('status.connected')}</>
          )}
          {status === 'disconnected' && (
            <><WifiOff size={14} /> {tc('status.disconnected')}</>
          )}
          {status === 'connecting' && (
            <><Loader2 size={14} className="anim-spin" /> {tc('status.connecting')}</>
          )}
          {status === 'error' && (
            <><XCircle size={14} /> {error ?? tc('status.error')}</>
          )}
          {status === 'suspended' && (
            <><AlertTriangle size={14} /> {tc('status.suspended')}</>
          )}
        </div>
      </div>

      {/* ── Gateway info (connected) ── */}
      {status === 'connected' && gatewayInfo && (
        <div className={`${styles.section} anim-fade-in-up stagger-2`}>
          <div className={styles.sectionTitle}>{t('gateway.infoTitle')}</div>
          <div className={styles.gatewayInfoGrid}>
            <div className={styles.gatewayInfoItem}>
              <span className={styles.gatewayInfoKey}>{t('info.protocol')}</span>
              <span className={styles.gatewayInfoVal}>v{String(protocol ?? '?')}</span>
            </div>
            <div className={styles.gatewayInfoItem}>
              <span className={styles.gatewayInfoKey}>{t('gateway.tickInterval')}</span>
              <span className={styles.gatewayInfoValMuted}>
                {policy?.tickIntervalMs ? `${Number(policy.tickIntervalMs) / 1000}s` : '?'}
              </span>
            </div>
            {version && (
              <div className={styles.gatewayInfoItem}>
                <span className={styles.gatewayInfoKey}>{t('info.version')}</span>
                <span className={styles.gatewayInfoValMuted}>{version}</span>
              </div>
            )}
            {nodeId && (
              <div className={styles.gatewayInfoItem}>
                <span className={styles.gatewayInfoKey}>{t('info.nodeId')}</span>
                <span className={styles.gatewayInfoValMuted}>{nodeId}</span>
              </div>
            )}
            <div className={styles.gatewayInfoItem}>
              <span className={styles.gatewayInfoKey}>{t('gateway.endpoint')}</span>
              <span className={styles.gatewayInfoValMuted}>{wsUrl}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Security Audit Log ── */}
      <div className={`${styles.section} anim-fade-in-up stagger-3`}>
        <div className={styles.sectionTitle}>{t('audit.title')}</div>
        <button className={styles.auditToggle} onClick={() => setShowAudit((v) => !v)}>
          {showAudit ? t('audit.toggle.hide') : t('audit.toggle.show')}
        </button>
        {showAudit && (
          <>
            {auditEntries.length === 0 ? (
              <div className={styles.auditEmpty}>{t('audit.empty')}</div>
            ) : (
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>{t('audit.columns.timestamp')}</th>
                    <th>{t('audit.columns.action')}</th>
                    <th>{t('audit.columns.detail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry) => (
                    <tr key={entry.id} className={styles.auditRow}>
                      <td className={styles.auditTimestamp}>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </td>
                      <td className={styles.auditAction}>{entry.action}</td>
                      <td className={styles.auditDetail}>{entry.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {auditEntries.length > 0 && (
              <button className={styles.auditClearBtn} onClick={auditClear}>
                {t('audit.clear')}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── About ── */}
      <div className={`${styles.section} anim-fade-in-up stagger-3`}>
        <div className={styles.sectionTitle}>{t('about.title')}</div>
        <p className={styles.aboutText}>{t('about.description')}</p>
        <p className={styles.aboutMeta}>{t('about.meta')}</p>
      </div>

      {/* ── Gateway Connection Error Modal ── */}
      {errorModalOpen && lastError && (
        <ConnectionErrorModal onClose={() => setErrorModalOpen(false)} />
      )}
    </div>
  );
}
