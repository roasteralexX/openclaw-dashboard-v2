import { useRef, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import type { SupportedLocale } from '../../i18n/config';
import styles from './LanguageSwitcher.module.css';

const LOCALE_LABELS: Record<SupportedLocale, { short: string; long: string; flag: string }> = {
  'en-US': { short: 'EN', long: 'English', flag: '🇺🇸' },
  'pt-BR': { short: 'PT', long: 'Português', flag: '🇧🇷' },
  'es':    { short: 'ES', long: 'Español',   flag: '🇪🇸' },
};

export default function LanguageSwitcher() {
  const { locale, setLocale, isChanging, supportedLocales } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const current = LOCALE_LABELS[locale];

  async function handleSelect(next: SupportedLocale) {
    if (next === locale) { setOpen(false); return; }
    setOpen(false);
    await setLocale(next);
  }

  return (
    <div className={styles.root} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch language"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={isChanging}
      >
        {isChanging ? (
          <Loader2 size={12} className={styles.spinner} />
        ) : (
          <span className={styles.flag}>{current.flag}</span>
        )}
        <span className={styles.short}>{current.short}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▾</span>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox" aria-label="Select language">
          {supportedLocales.map((loc) => {
            const info = LOCALE_LABELS[loc];
            const isActive = loc === locale;
            return (
              <li key={loc} role="option" aria-selected={isActive}>
                <button
                  className={`${styles.option} ${isActive ? styles.optionActive : ''}`}
                  onClick={() => handleSelect(loc)}
                >
                  <span className={styles.flag}>{info.flag}</span>
                  <span className={styles.optionLong}>{info.long}</span>
                  {isActive && <span className={styles.check}>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
