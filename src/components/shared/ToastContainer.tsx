import { useToastStore } from '../../store/toastStore';
import Toast from './Toast';

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '52px', // above the 36px footer
  right: '20px',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  pointerEvents: 'none',
};

const itemStyle: React.CSSProperties = {
  pointerEvents: 'auto',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div style={containerStyle} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} style={itemStyle}>
          <Toast toast={toast} />
        </div>
      ))}
    </div>
  );
}
