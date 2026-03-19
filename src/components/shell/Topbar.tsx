import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAgentStore } from '../../store/agentStore';
import { useI18n } from '../../hooks/useI18n';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';
import styles from './Topbar.module.css';

export default function Topbar() {
  const location = useLocation();
  const agents = useAgentStore((s) => s.agents);
  const { t, locale } = useI18n();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const routeTitles: Record<string, string> = {
    '/': t('nav.overview'),
    '/agents': t('nav.agents'),
    '/crons': t('nav.crons'),
    '/office': t('nav.office'),
    '/board': t('nav.board'),
    '/settings': t('nav.settings'),
  };

  const title =
    routeTitles[location.pathname] ||
    Object.entries(routeTitles).find(([k]) =>
      k !== '/' && location.pathname.startsWith(k)
    )?.[1] ||
    t('nav.overview');

  const totalTokens = agents.reduce((s, a) => s + a.tokensUsedToday, 0);
  const activeCount = agents.filter((a) => a.status === 'active').length;

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
      <div className={styles.right}>
        <div className={styles.statPill}>
          <Zap size={12} />
          <span className={styles.statValue}>{(totalTokens / 1000).toFixed(1)}K</span>
          {t('labels.tokensToday')}
        </div>
        <div className={styles.statPill}>
          <span className={styles.statValue}>{activeCount}</span>
          {t('nav.agents').toLowerCase()}
        </div>
        <div className={styles.clock}>
          {time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
