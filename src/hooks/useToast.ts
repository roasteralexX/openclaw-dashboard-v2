import { useToastStore } from '../store/toastStore';

export function useToast() {
  const add = useToastStore((s) => s.add);
  return {
    success: (message: string, duration?: number) => add({ type: 'success', message, duration: duration ?? 4000 }),
    error:   (message: string, duration?: number) => add({ type: 'error',   message, duration: duration ?? 6000 }),
    info:    (message: string, duration?: number) => add({ type: 'info',    message, duration: duration ?? 4000 }),
    warn:    (message: string, duration?: number) => add({ type: 'warn',    message, duration: duration ?? 4000 }),
  };
}
