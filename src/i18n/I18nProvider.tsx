import { Suspense, useEffect, type ReactNode } from 'react';
import { useI18nStore } from '../store/i18nStore';

/* ── Global loader shown while locale bundles are fetching ── */

function GlobalLoader() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--c-base-900, #050810)',
        color: 'var(--c-text-muted, #556677)',
        fontFamily: 'var(--ff-mono, monospace)',
        fontSize: '0.875rem',
        gap: '0.5rem',
        zIndex: 9999,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          animation: 'spin 1.2s linear infinite',
        }}
      >
        ⬡
      </span>
      Loading…
    </div>
  );
}

interface I18nProviderProps {
  children: ReactNode;
}

/**
 * I18nProvider
 *
 * Responsibilities:
 * 1. Runs detectLocale() once on mount so the locale is resolved
 *    from localStorage / navigator.language before the first render.
 * 2. Wraps children in a <Suspense> boundary so that components using
 *    useTranslation() with useSuspense:true don't blow up while their
 *    namespace JSON is being fetched.
 *
 * Place this component around <App /> (or just inside <ThemeProvider>)
 * in main.tsx — it is transparent to React Router DOM.
 */
export default function I18nProvider({ children }: I18nProviderProps) {
  const detectLocale = useI18nStore((s) => s.detectLocale);

  useEffect(() => {
    // Fire-and-forget: detectLocale sets isChangingLocale while it runs,
    // which lets the LanguageSwitcher show a spinner on first load if needed.
    detectLocale();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <Suspense fallback={<GlobalLoader />}>{children}</Suspense>;
}
