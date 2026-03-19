/**
 * OpenClaw Gateway WebSocket RPC Client
 *
 * Handles the full lifecycle:
 *  1. WebSocket connect → receive `connect.challenge` event
 *  2. Send `connect` RPC request with auth token
 *  3. Receive `hello-ok` response
 *  4. Normal RPC calls: {type:"req", id, method, params} → {type:"res", id, ok, payload}
 *  5. Event subscriptions: {type:"event", event, payload}
 *  6. Keepalive ticks + auto-reconnect with exponential backoff
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'suspended';

export interface ClientConfig {
  wsUrl: string;
  authToken?: string;
  tlsFingerprint?: string;         // stored for future native wrapper use
  maxReconnectAttempts?: number;   // default: 10; 0 = unlimited
  onStateChange?: (state: ConnectionState, error?: string) => void;
  onEvent?: (event: string, payload: unknown) => void;
}

/* ── Transport security helpers ──────────────────── */

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return false;
  }
}

/** Returns true if the URL is safe to connect to without TLS.
 *  wss:// → always safe.
 *  ws:// → only safe for loopback (127.0.0.1, localhost, ::1).
 */
function isSecureEnough(wsUrl: string): boolean {
  if (wsUrl.startsWith('wss://')) return true;
  if (wsUrl.startsWith('ws://') && isLoopback(wsUrl)) return true;
  return false;
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const CLIENT_ID = 'openclaw-dashboard';
const CLIENT_VERSION = '2.0.0';

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private config: ClientConfig;
  private state: ConnectionState = 'disconnected';
  private pending = new Map<string, PendingRequest>();
  private eventListeners = new Map<string, Set<(payload: unknown) => void>>();
  private reqCounter = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private tickIntervalMs = 15_000;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private helloPayload: unknown = null;
  private readonly maxReconnectAttempts: number;
  private lastWsCloseCode = 0;
  private lastWsCloseReason: string | null = null;

  constructor(config: ClientConfig) {
    this.config = config;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
  }

  /* ── Public API ───────────────────────────────────── */

  get connectionState(): ConnectionState {
    return this.state;
  }

  get gatewayInfo(): unknown {
    return this.helloPayload;
  }

  get lastCloseInfo(): { code: number; reason: string | null } {
    return { code: this.lastWsCloseCode, reason: this.lastWsCloseReason };
  }

  connect(): void {
    if (this.state === 'connecting' || this.state === 'connected') return;
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.doConnect();
  }

  /** Reset the circuit breaker and retry the connection. */
  resetCircuit(): void {
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.doConnect();
  }

  /** Stop automatic reconnection without changing state or closing any open socket. */
  stopAutoReconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.clearTickInterval();
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }
    this.rejectAllPending('Client disconnected');
    this.setState('disconnected');
  }

  /** Fire-and-forget RPC call */
  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.state !== 'connected') {
      throw new Error(`Cannot call '${method}': not connected (state=${this.state})`);
    }
    const id = this.nextId();
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout for '${method}' (id=${id})`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: resolve as (payload: unknown) => void,
        reject,
        timeout,
      });

      this.send({ type: 'req', id, method, params });
    });
  }

  /** Subscribe to gateway events */
  on(event: string, callback: (payload: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /** Update config without reconnecting */
  updateConfig(partial: Partial<ClientConfig>): void {
    Object.assign(this.config, partial);
  }

  /* ── Internal ─────────────────────────────────────── */

  private doConnect(): void {
    // ── Transport security check ──────────────────────
    if (!isSecureEnough(this.config.wsUrl)) {
      this.shouldReconnect = false;
      this.setState('error', 'INSECURE_WS: non-loopback ws:// is not allowed. Use wss://.');
      return;
    }

    this.setState('connecting');
    try {
      this.ws = new WebSocket(this.config.wsUrl);
    } catch (err) {
      this.setState('error', `WebSocket creation failed: ${err}`);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      // Wait for connect.challenge event from gateway
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        this.handleMessage(msg);
      } catch {
        // Ignore non-JSON frames
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };

    this.ws.onclose = (ev) => {
      this.clearTickInterval();
      this.rejectAllPending('Connection closed');
      this.lastWsCloseCode = ev.code;
      this.lastWsCloseReason = ev.reason?.trim() || null;
      if (ev.code === 1008) {
        // Policy violation: gateway explicitly rejected us — retrying won't help.
        this.shouldReconnect = false;
        this.setState('error', this.lastWsCloseReason ?? 'Policy violation');
      } else if (this.state !== 'disconnected') {
        this.setState('disconnected');
      }
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    if (type === 'event') {
      this.handleEvent(msg);
    } else if (type === 'res') {
      this.handleResponse(msg);
    }
  }

  private handleEvent(msg: Record<string, unknown>): void {
    const event = msg.event as string;
    const payload = msg.payload;

    if (event === 'connect.challenge') {
      // Step 1: Receive nonce, respond with connect request
      this.sendConnectRequest();
      return;
    }

    // Broadcast to listeners
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((cb) => {
        try { cb(payload); } catch { /* ignore listener errors */ }
      });
    }
    // Wildcard listeners
    const wildcard = this.eventListeners.get('*');
    if (wildcard) {
      wildcard.forEach((cb) => {
        try { cb({ event, payload }); } catch { /* ignore */ }
      });
    }
  }

  private handleResponse(msg: Record<string, unknown>): void {
    const id = msg.id as string;
    const ok = msg.ok as boolean;
    const pending = this.pending.get(id);

    if (!pending) return; // No matching request
    this.pending.delete(id);
    clearTimeout(pending.timeout);

    if (ok) {
      const payload = msg.payload as Record<string, unknown> | undefined;

      // Check if this is the hello-ok response from connect
      if (payload && (payload as Record<string, unknown>).type === 'hello-ok') {
        this.handleHelloOk(payload);
      }

      pending.resolve(msg.payload);
    } else {
      pending.reject(new Error(
        typeof msg.error === 'string'
          ? msg.error
          : JSON.stringify(msg.error ?? 'Unknown RPC error')
      ));
    }
  }

  private sendConnectRequest(): void {
    const id = this.nextId();

    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: CLIENT_ID,
        version: CLIENT_VERSION,
        platform: 'web',
        mode: 'operator',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      caps: [],
      commands: [],
      permissions: {},
      locale: navigator.language || 'en-US',
      userAgent: `openclaw-dashboard/${CLIENT_VERSION}`,
      device: {
        id: this.getDeviceFingerprint(),
      },
    };

    if (this.config.authToken) {
      params.auth = { token: this.config.authToken };
    }

    // Register the pending connect request
    const connectPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Connect handshake timeout'));
        this.setState('error', 'Connect handshake timeout');
        this.ws?.close();
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timeout });
    });

    this.send({ type: 'req', id, method: 'connect', params });

    connectPromise.catch(() => {
      // Error already handled via setState
    });
  }

  private handleHelloOk(payload: Record<string, unknown>): void {
    this.helloPayload = payload;
    this.reconnectAttempt = 0;

    // Set up keepalive ticks
    const policy = payload.policy as { tickIntervalMs?: number } | undefined;
    this.tickIntervalMs = Math.max(1_000, Math.min(policy?.tickIntervalMs ?? 15_000, 300_000));
    this.startTickInterval();

    this.setState('connected');
  }

  private startTickInterval(): void {
    this.clearTickInterval();
    this.tickInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'req', id: this.nextId(), method: 'tick', params: {} });
      }
    }, this.tickIntervalMs);
  }

  private clearTickInterval(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    // ── Circuit breaker ───────────────────────────────
    if (this.maxReconnectAttempts > 0 && this.reconnectAttempt >= this.maxReconnectAttempts) {
      this.shouldReconnect = false;
      this.setState(
        'suspended',
        `Circuit open after ${this.maxReconnectAttempts} failed attempts. Use resetCircuit() to retry.`,
      );
      return;
    }

    this.clearReconnectTimer();
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), MAX_BACKOFF_MS);
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.doConnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private nextId(): string {
    return `d-${++this.reqCounter}`;
  }

  private setState(state: ConnectionState, error?: string): void {
    this.state = state;
    this.config.onStateChange?.(state, error);
  }

  private rejectAllPending(reason: string): void {
    this.pending.forEach((p) => {
      clearTimeout(p.timeout);
      p.reject(new Error(reason));
    });
    this.pending.clear();
  }

  private getDeviceFingerprint(): string {
    const key = 'openclaw-dashboard-device-id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `web-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }
}
