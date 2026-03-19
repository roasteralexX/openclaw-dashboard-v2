import { useCallback } from 'react';
import { useI18n } from './useI18n';

export function useTimeAgo() {
  const { t: tc } = useI18n();

  const timeAgo = useCallback(
    (iso: string | number | undefined, seconds?: boolean): string => {
      if (iso == null) return tc('time.justNow');

      const diff = Date.now() - new Date(iso).getTime();
      const s = Math.floor(diff / 1000);

      if (seconds && s < 60) {
        const secsKey = tc('time.secsAgo', { count: s });
        return secsKey !== 'time.secsAgo' ? secsKey : tc('time.justNow');
      }

      const m = Math.floor(diff / 60000);

      if (m < 1) return tc('time.justNow');
      if (m < 60) return tc('time.minsAgo', { count: m });

      const h = Math.floor(m / 60);
      if (h < 24) return tc('time.hoursAgo', { count: h });

      return tc('time.daysAgo', { count: Math.floor(h / 24) });
    },
    [tc],
  );

  return timeAgo;
}
