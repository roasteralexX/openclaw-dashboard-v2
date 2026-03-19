/**
 * i18n type augmentation for react-i18next.
 *
 * Importing all namespace JSON files as types lets TypeScript validate
 * every t() call — unknown keys become compile errors, not runtime bugs.
 *
 * Usage:
 *   const { t } = useTranslation('kanban');
 *   t('columns.todo')           // ✅ valid
 *   t('columns.nonexistent')    // ❌ TypeScript error
 */

import type commonEn from '../locales/en-US/common.json';
import type dashboardEn from '../locales/en-US/dashboard.json';
import type agentsEn from '../locales/en-US/agents.json';
import type chatEn from '../locales/en-US/chat.json';
import type cronsEn from '../locales/en-US/crons.json';
import type kanbanEn from '../locales/en-US/kanban.json';
import type office3dEn from '../locales/en-US/office3d.json';
import type chartsEn from '../locales/en-US/charts.json';
import type errorsEn from '../locales/en-US/errors.json';
import type settingsEn from '../locales/en-US/settings.json';
import type healthEn from '../locales/en-US/health.json';

/**
 * Augment the react-i18next module with the shape of our namespaces.
 * Only en-US is used for the type — all locales must match this structure.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof commonEn;
      dashboard: typeof dashboardEn;
      agents: typeof agentsEn;
      chat: typeof chatEn;
      crons: typeof cronsEn;
      kanban: typeof kanbanEn;
      office3d: typeof office3dEn;
      charts: typeof chartsEn;
      errors: typeof errorsEn;
      settings: typeof settingsEn;
      health: typeof healthEn;
    };
  }
}
