import { useToastStore, type ToastItem } from '../../store/toastStore';
import styles from './Toast.module.css';

const icons: Record<ToastItem['type'], string> = {
  success: '✓',
  error:   '✗',
  info:    'ℹ',
  warn:    '⚠',
};

const typeClass: Record<ToastItem['type'], string> = {
  success: styles.toastSuccess,
  error:   styles.toastError,
  info:    styles.toastInfo,
  warn:    styles.toastWarn,
};

const iconClass: Record<ToastItem['type'], string> = {
  success: styles.iconSuccess,
  error:   styles.iconError,
  info:    styles.iconInfo,
  warn:    styles.iconWarn,
};

const progressClass: Record<ToastItem['type'], string> = {
  success: styles.progressSuccess,
  error:   styles.progressError,
  info:    styles.progressInfo,
  warn:    styles.progressWarn,
};

export default function Toast({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove);

  return (
    <div className={`${styles.toast} ${typeClass[toast.type]}`} role="alert">
      <span className={`${styles.icon} ${iconClass[toast.type]}`}>
        {icons[toast.type]}
      </span>
      <span className={styles.message}>{toast.message}</span>
      <button
        className={styles.close}
        onClick={() => remove(toast.id)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
      <div
        className={`${styles.progress} ${progressClass[toast.type]}`}
        style={{ animationDuration: `${toast.duration}ms` }}
      />
    </div>
  );
}
