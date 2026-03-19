import { create } from 'zustand';
import i18next from '../i18n/config';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../i18n/config';

const LS_KEY = 'openclaw-locale';

/** Narrow an arbitrary string to a SupportedLocale or return null. */
function toSupportedLocale(raw: string | null | undefined): SupportedLocale | null {
  if (!raw) return null;
  // Exact match first
  if ((SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
    return raw as SupportedLocale;
  }
  // Partial match: navigator may report 'pt' → map to 'pt-BR', 'en' → 'en-US'
  const prefix = raw.split('-')[0].toLowerCase();
  const match = SUPPORTED_LOCALES.find((l) =>
    l.toLowerCase().startsWith(prefix),
  );
  return match ?? null;
}

interface I18nState {
  /** Currently active locale. */
  locale: SupportedLocale;
  /** True while i18next is loading the new locale bundle. */
  isChangingLocale: boolean;

  /**
   * Detect the initial locale from: localStorage → navigator.language → 'en-US'.
   * Applies it to i18next and the store state.
   * Call once at app boot (inside I18nProvider).
   */
  detectLocale: () => Promise<void>;

  /**
   * Switch to a new locale.
   * Persists choice in localStorage and updates i18next synchronously.
   */
  setLocale: (locale: SupportedLocale) => Promise<void>;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: 'en-US',
  isChangingLocale: false,

  detectLocale: async () => {
    // Only honour an explicit user choice from localStorage.
    // Browser language is intentionally ignored — the app defaults to en-US.
    const fromStorage = toSupportedLocale(localStorage.getItem(LS_KEY));
    const resolved = fromStorage ?? 'en-US';

    set({ isChangingLocale: true });
    await i18next.changeLanguage(resolved);
    set({ locale: resolved, isChangingLocale: false });
  },

  setLocale: async (locale) => {
    set({ isChangingLocale: true });
    localStorage.setItem(LS_KEY, locale);
    await i18next.changeLanguage(locale);
    set({ locale, isChangingLocale: false });
  },
}));
