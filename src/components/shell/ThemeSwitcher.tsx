import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../hooks/useI18n';
import styles from './ThemeSwitcher.module.css';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const isDark = theme === 'dark';

  return (
    <button
      className={styles.toggle}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('accessibility.switchToLightMode') : t('accessibility.switchToDarkMode')}
      title={isDark ? t('accessibility.lightMode') : t('accessibility.darkMode')}
    >
      <span className={`${styles.icon} ${styles.iconSun} ${!isDark ? styles.iconActive : ''}`}>
        <Sun size={13} />
      </span>
      <span className={`${styles.track} ${!isDark ? styles.trackLight : ''}`}>
        <span className={`${styles.thumb} ${!isDark ? styles.thumbLight : ''}`} />
      </span>
      <span className={`${styles.icon} ${styles.iconMoon} ${isDark ? styles.iconActive : ''}`}>
        <Moon size={13} />
      </span>
    </button>
  );
}
