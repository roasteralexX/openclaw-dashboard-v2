import { create } from 'zustand';
import { OpenClawClient, type ConnectionState } from '../api/openclawClient';
import { parseGatewayError, type GatewayErrorInfo } from '../api/gatewayErrors';
import { useToastStore } from './toastStore';
import { useAuditStore } from './auditStore';

function redactWsUrl(url: string): string {
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    return u.toString();
  } catch {
    return '[invalid url]';
  }
}

const LS_KEY        = 'openclaw-gateway-url';
const SS_KEY        = 'openclaw-gateway-token';
const LS_TLS_FP_KEY = 'openclaw-gateway-tls-fp';

interface ConnectionStore {
  /* state */
  wsUrl: string;
  authToken: string;
  tlsFingerprint: string;
  status: ConnectionState;
  error: string | null;
  lastError: GatewayErrorInfo | null;
  gatewayInfo: Record<string, unknown> | null;

  /* client singleton */
  client: OpenClawClient | null;

  /* actions */
  setConfig: (wsUrl: string, authToken: string, tlsFingerprint?: string) => void;
  connect: () => void;
  disconnect: () => void;
  resetCircuit: () => void;
  clearError: () => void;
  isReady: () => boolean;

  /** Derived: security level of the current wsUrl */
  transportMode: () => 'secure' | 'local' | 'insecure';
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  wsUrl:          localStorage.getItem(LS_KEY)        || 'ws://127.0.0.1:18789',
  authToken:      sessionStorage.getItem(SS_KEY)      || '',
  tlsFingerprint: localStorage.getItem(LS_TLS_FP_KEY) || '',
  status: 'disconnected',
  error: null,
  lastError: null,
  gatewayInfo: null,
  client: null,

  setConfig: (wsUrl, authToken, tlsFingerprint) => {
    localStorage.setItem(LS_KEY, wsUrl);
    sessionStorage.setItem(SS_KEY, authToken);
    if (tlsFingerprint !== undefined) {
      localStorage.setItem(LS_TLS_FP_KEY, tlsFingerprint);
    }
    set({
      wsUrl,
      authToken,
      ...(tlsFingerprint !== undefined ? { tlsFingerprint } : {}),
    });

    useAuditStore.getState().log('settings.save', `Endpoint updated to ${redactWsUrl(wsUrl)}`);

    const { client } = get();
    if (client) {
      client.disconnect();
      set({ client: null, status: 'disconnected', error: null, lastError: null, gatewayInfo: null });
    }
  },

  connect: () => {
    const { wsUrl, authToken, tlsFingerprint, client: existingClient } = get();

    if (existingClient) {
      existingClient.disconnect();
    }

    useAuditStore.getState().log('connect', `Connecting to ${redactWsUrl(wsUrl)}`, { wsUrl: redactWsUrl(wsUrl) });

    const client = new OpenClawClient({
      wsUrl,
      authToken: authToken || undefined,
      tlsFingerprint: tlsFingerprint || undefined,
      maxReconnectAttempts: 10,
      onStateChange: (state, error) => {
        const prev = get().status; // capture BEFORE set — after set, get().status === state
        const { code, reason } = client.lastCloseInfo;
        // Compute lastError:
        //  - Any meaningful close code → parse error (covers 1006 network failures too)
        //  - connected → clear it
        //  - connecting → preserve whatever was there
        let lastError = get().lastError;
        if (code !== 0 && code !== 1000 && code !== 1001) {
          lastError = parseGatewayError(code, reason);
        } else if (state === 'connected') {
          lastError = null;
        }
        set({
          status: state,
          error: error ?? null,
          lastError,
          gatewayInfo: state === 'connected'
            ? (client.gatewayInfo as Record<string, unknown> | null)
            : get().gatewayInfo,
        });
        const { add } = useToastStore.getState();
        if (state === 'connected') {
          add({ type: 'success', message: 'Connected to OpenClaw Gateway', duration: 4000 });
        } else if (state === 'error') {
          const msg = error ?? 'connection failed';
          const isInsecure = msg.startsWith('INSECURE_WS');
          add({
            type: 'error',
            message: isInsecure
              ? 'Insecure connection blocked — use wss:// for non-loopback hosts'
              : `Gateway error: ${msg}`,
            duration: isInsecure ? 0 : 6000,
          });
        } else if (state === 'disconnected' && prev === 'connected') {
          useAuditStore.getState().log('disconnect', 'Connection closed by gateway');
          add({ type: 'warn', message: 'Disconnected from gateway', duration: 4000 });
        } else if (state === 'suspended') {
          add({
            type: 'error',
            message: 'Connection suspended — too many failures. Click Resume in the sidebar.',
            duration: 0,
          });
        }
      },
      onEvent: () => {
        // Individual stores subscribe directly via client.on()
      },
    });

    set({ client, status: 'connecting', error: null });
    client.connect();
  },

  disconnect: () => {
    const { client } = get();
    if (client) {
      client.disconnect();
    }
    useAuditStore.getState().log('disconnect', 'User initiated disconnect');
    set({ client: null, status: 'disconnected', error: null, lastError: null, gatewayInfo: null });
  },

  clearError: () => {
    // Stop the reconnect loop so the modal doesn't keep re-opening on each failure.
    // The user must click Connect manually to retry.
    get().client?.stopAutoReconnect();
    set({ lastError: null });
  },

  resetCircuit: () => {
    const { client } = get();
    if (client) {
      client.resetCircuit();
    } else {
      // No existing client — start fresh
      get().connect();
    }
  },

  isReady: () => get().status === 'connected',

  transportMode: () => {
    const url = get().wsUrl;
    if (url.startsWith('wss://')) return 'secure';
    try {
      const host = new URL(url).hostname;
      if (host === '127.0.0.1' || host === 'localhost' || host === '::1') return 'local';
    } catch {
      // malformed URL — treat as insecure
    }
    return 'insecure';
  },
}));
