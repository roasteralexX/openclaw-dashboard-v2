/**
 * useI18n — thin wrapper around useTranslation + i18nStore.
 *
 * Provides:
 *   - `t`              — type-safe translator (defaults to 'common' namespace)
 *   - `tc`             — common-namespace translator (equals `t` when no namespace is given)
 *   - `locale`         — current SupportedLocale
 *   - `setLocale`      — persists + applies a new locale
 *   - `isChanging`     — true while the locale bundle is loading
 *   - `supportedLocales` — array of all available locales
 *
 * Usage:
 *   const { t, locale, setLocale } = useI18n();
 *   const { t } = useI18n('kanban');        // specific namespace
 *   const { t, tc } = useI18n('kanban');    // t = kanban, tc = common
 */

import { useTranslation } from 'react-i18next';
import { useI18nStore } from '../store/i18nStore';
import { SUPPORTED_LOCALES, type Namespace } from '../i18n/config';

export function useI18n(ns: Namespace = 'common') {
  const { t, i18n } = useTranslation(ns);
  const { t: tc } = useTranslation('common');
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const isChanging = useI18nStore((s) => s.isChangingLocale);

  return {
    t,
    tc,
    i18n,
    locale,
    setLocale,
    isChanging,
    supportedLocales: SUPPORTED_LOCALES,
  } as const;
}
