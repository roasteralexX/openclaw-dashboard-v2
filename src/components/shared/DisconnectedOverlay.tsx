import styles from './DisconnectedOverlay.module.css';

interface DisconnectedOverlayProps {
  connected: boolean;
  emptyState: React.ReactNode;
  children: React.ReactNode;
}

export default function DisconnectedOverlay({
  connected,
  emptyState,
  children,
}: DisconnectedOverlayProps) {
  if (connected) return <>{children}</>;

  return (
    <div className={styles.outer}>
      <div className={styles.blurred} aria-hidden="true">
        {children}
      </div>
      <div className={styles.overlay}>
        {emptyState}
      </div>
    </div>
  );
}
