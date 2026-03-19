import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
// Type augmentation — must be imported for TypeScript to validate t() calls
import './types';

export const SUPPORTED_LOCALES = ['en-US', 'pt-BR', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const NAMESPACES = [
  'common',
  'dashboard',
  'agents',
  'chat',
  'crons',
  'kanban',
  'office3d',
  'charts',
  'errors',
  'settings',
  'health',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

/**
 * Vite's dynamic import with a template literal produces a known
 * set of chunks at build time. Each locale+namespace combo becomes
 * its own async chunk (code-split automatically by Rollup/Rolldown).
 */
i18next
  .use(
    resourcesToBackend(
      (lng: string, ns: string) =>
        import(`../locales/${lng}/${ns}.json`),
    ),
  )
  .use(initReactI18next)
  .init({
    defaultNS: 'common',
    fallbackLng: 'en-US',
    supportedLngs: SUPPORTED_LOCALES,

    // Language detection is handled by the Zustand store (detectLocale).
    // We set lng explicitly from the store so we don't need a detection plugin.
    lng: 'en-US',

    interpolation: {
      // React already escapes output — no double-escaping needed.
      escapeValue: false,
    },

    react: {
      // Suspense mode: components that call useTranslation() will suspend
      // until their namespace bundle is loaded.
      useSuspense: true,
    },

    // Namespace separator and key separator — keep defaults (':' and '.')
    // nsSeparator: ':',
    // keySeparator: '.',
  });

export default i18next;
