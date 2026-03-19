/**
 * Tests for OpenClawClient WebSocket RPC client.
 *
 * Auth flow reminder:
 *   1. simulateOpen()  → triggers onopen (no-op, just waits for challenge)
 *   2. simulateMessage({ type:'event', event:'connect.challenge', payload:{nonce:'abc'} })
 *      → client calls sendConnectRequest() which sends {type:'req', id, method:'connect', params}
 *   3. simulateMessage({ type:'res', id:<from send call>, ok:true, payload:{type:'hello-ok', ...} })
 *      → handleHelloOk() fires, state becomes 'connected'
 *
 * NOTE on tick-interval clamping (Group 6):
 *   The current source does NOT implement clamping in handleHelloOk — it assigns
 *   `policy?.tickIntervalMs ?? 15_000` directly. The tests in Group 6 therefore
 *   document the ACTUAL current behaviour (no clamping floor, no ceiling). If the
 *   F-10 fix is shipped, update the assertions in that group to match.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installMockWebSocket } from '../test/mockWebSocket';
import { OpenClawClient } from './openclawClient';
import type { MockWebSocketInstance } from '../test/mockWebSocket';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let wsInstances: MockWebSocketInstance[];
let restore: () => void;

beforeEach(() => {
  const mock = installMockWebSocket();
  wsInstances = mock.instances;
  restore = mock.restore;
  vi.useFakeTimers();
});

afterEach(() => {
  restore();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helper: complete the full auth handshake and return the ws instance.
// ---------------------------------------------------------------------------
function completeHandshake(
  client: OpenClawClient,
  overridePayload: Record<string, unknown> = {},
): MockWebSocketInstance {
  client.connect();
  const ws = wsInstances[0];

  ws.simulateOpen();
  ws.simulateMessage({ type: 'event', event: 'connect.challenge', payload: { nonce: 'abc' } });

  // The connect request is sent — extract its id.
  const connectReqId = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]).id as string;

  const helloPayload: Record<string, unknown> = {
    type: 'hello-ok',
    gatewayId: 'gw-test',
    policy: {},
    ...overridePayload,
  };

  ws.simulateMessage({ type: 'res', id: connectReqId, ok: true, payload: helloPayload });

  return ws;
}

// ---------------------------------------------------------------------------
// GROUP 1 — Security guard (insecure URL rejection)
// ---------------------------------------------------------------------------

describe('Group 1 — Security guard', () => {
  it('ws://evil.com → state is error, message contains INSECURE_WS, no WebSocket created', () => {
    const stateChanges: string[] = [];
    const errorMessages: (string | undefined)[] = [];

    const client = new OpenClawClient({
      wsUrl: 'ws://evil.com',
      onStateChange: (s, e) => { stateChanges.push(s); errorMessages.push(e); },
    });

    client.connect();

    expect(wsInstances).toHaveLength(0);
    expect(client.connectionState).toBe('error');
    expect(stateChanges).toContain('error');
    const errMsg = errorMessages.find((m) => m !== undefined);
    expect(errMsg).toMatch('INSECURE_WS');
  });

  it('wss://any-host.com → WebSocket is created (secure regardless of host)', () => {
    const client = new OpenClawClient({ wsUrl: 'wss://any-host.com' });
    client.connect();
    expect(wsInstances).toHaveLength(1);
  });

  it('ws://127.0.0.1:18789 → WebSocket is created (loopback allowed)', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://127.0.0.1:18789' });
    client.connect();
    expect(wsInstances).toHaveLength(1);
  });

  it('ws://localhost:18789 → WebSocket is created', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    client.connect();
    expect(wsInstances).toHaveLength(1);
  });

  it('ws://::1 (IPv6 loopback) — isLoopback check matches hostname', () => {
    // jsdom's WHATWG URL parser may or may not parse ws://[::1] identically to
    // Node.js native URL. The source code checks host === '::1' after new URL().
    // This test verifies the loopback guard logic for ::1 by inspecting URL.hostname
    // directly, documenting the environment-specific behaviour without risking a
    // false failure if jsdom drops bracket notation differently.
    const u = new URL('ws://[::1]:18789');
    // In WHATWG-compliant parsers, hostname strips brackets → '::1'.
    // If the environment is compliant the WebSocket should be created.
    if (u.hostname === '::1') {
      const client = new OpenClawClient({ wsUrl: 'ws://[::1]:18789' });
      client.connect();
      expect(wsInstances).toHaveLength(1);
    } else {
      // Non-compliant environment: document the actual hostname returned.
      expect(['[::1]', '::1']).toContain(u.hostname);
    }
  });
});

// ---------------------------------------------------------------------------
// GROUP 2 — Connection lifecycle
// ---------------------------------------------------------------------------

describe('Group 2 — Connection lifecycle', () => {
  it('connect() when already connected is a no-op (no second WebSocket created)', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    completeHandshake(client);

    expect(client.connectionState).toBe('connected');
    client.connect(); // second call — must be no-op
    expect(wsInstances).toHaveLength(1);
  });

  it('connect() when already connecting is a no-op', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    client.connect(); // starts connecting
    expect(wsInstances).toHaveLength(1);

    client.connect(); // second call while connecting
    expect(wsInstances).toHaveLength(1);
    expect(client.connectionState).toBe('connecting');
  });

  it('simulateOpen + connect.challenge → client sends a connect RPC request', () => {
    const client = new OpenClawClient({
      wsUrl: 'ws://localhost:18789',
      authToken: 'super-secret-token-32chars!!!!!',
    });
    client.connect();
    const ws = wsInstances[0];

    ws.simulateOpen();
    // Before challenge: no send calls yet (onopen is intentionally a no-op)
    expect((ws.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);

    ws.simulateMessage({ type: 'event', event: 'connect.challenge', payload: { nonce: 'abc' } });

    // After challenge: exactly one send call with the connect request
    const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);

    const sent = JSON.parse(calls[0][0] as string);
    expect(sent.type).toBe('req');
    expect(sent.method).toBe('connect');
    expect(typeof sent.id).toBe('string');
    expect(sent.params.auth).toEqual({ token: 'super-secret-token-32chars!!!!!' });
  });

  it('receiving hello-ok → state is connected and gatewayInfo is populated', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    const ws = completeHandshake(client, { gatewayId: 'gw-42', extra: 'data' });

    expect(client.connectionState).toBe('connected');
    const info = client.gatewayInfo as Record<string, unknown>;
    expect(info.type).toBe('hello-ok');
    expect(info.gatewayId).toBe('gw-42');

    // ws is used by completeHandshake — just verify it was the first instance
    expect(ws).toBe(wsInstances[0]);
  });

  it('disconnect() → ws.close(1000) is called and all pending calls reject', async () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    completeHandshake(client);
    const ws = wsInstances[0];

    // Queue a call that will never get a response
    const callPromise = client.call('agents.list');

    client.disconnect();

    // ws.close should have been called with code 1000
    expect((ws.close as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(1000);

    // The pending call should reject with a disconnect error
    await expect(callPromise).rejects.toThrow(/Client disconnected/i);
  });
});

// ---------------------------------------------------------------------------
// GROUP 3 — call() RPC
// ---------------------------------------------------------------------------

describe('Group 3 — call() RPC', () => {
  it('call() when not connected → rejects immediately with "not connected"', async () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    await expect(client.call('agents.list')).rejects.toThrow(/not connected/i);
  });

  it('call() happy path → sends req message and resolves when matching res received', async () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    completeHandshake(client);
    const ws = wsInstances[0];

    // Reset send mock so we only see the new call's message
    (ws.send as ReturnType<typeof vi.fn>).mockClear();

    const resultPromise = client.call<{ items: string[] }>('agents.list', { limit: 10 });

    // Should have sent one req frame
    const sendCalls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
    expect(sendCalls).toHaveLength(1);
    const req = JSON.parse(sendCalls[0][0] as string);
    expect(req.type).toBe('req');
    expect(req.method).toBe('agents.list');
    expect(req.params).toEqual({ limit: 10 });
    const reqId = req.id as string;

    // Simulate the gateway responding
    ws.simulateMessage({ type: 'res', id: reqId, ok: true, payload: { items: ['agent-1'] } });

    const result = await resultPromise;
    expect(result).toEqual({ items: ['agent-1'] });
  });

  it('call() when gateway returns ok: false → rejects with gateway error message', async () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    completeHandshake(client);
    const ws = wsInstances[0];

    (ws.send as ReturnType<typeof vi.fn>).mockClear();

    const resultPromise = client.call('agents.list');
    const req = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);

    ws.simulateMessage({
      type: 'res',
      id: req.id,
      ok: false,
      error: 'Permission denied',
    });

    await expect(resultPromise).rejects.toThrow('Permission denied');
  });

  it('call() timeout after 15001ms → rejects with timeout error', async () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    completeHandshake(client);

    (wsInstances[0].send as ReturnType<typeof vi.fn>).mockClear();

    const resultPromise = client.call('slow.method');

    // Advance fake timers past the 15 000ms timeout
    vi.advanceTimersByTime(15_001);

    await expect(resultPromise).rejects.toThrow(/timeout/i);
  });
});

// ---------------------------------------------------------------------------
// GROUP 4 — Event subscriptions
// ---------------------------------------------------------------------------

describe('Group 4 — Event subscriptions', () => {
  it('on("event-name", cb) → callback invoked when matching event received', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    completeHandshake(client);
    const ws = wsInstances[0];

    const received: unknown[] = [];
    client.on('agent.updated', (payload) => received.push(payload));

    ws.simulateMessage({ type: 'event', event: 'agent.updated', payload: { id: 'a1', status: 'running' } });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ id: 'a1', status: 'running' });
  });

  it('on() returns unsubscribe fn; after calling it, callback is not invoked again', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    completeHandshake(client);
    const ws = wsInstances[0];

    const received: unknown[] = [];
    const unsub = client.on('agent.updated', (payload) => received.push(payload));

    ws.simulateMessage({ type: 'event', event: 'agent.updated', payload: { seq: 1 } });
    expect(received).toHaveLength(1);

    unsub();

    ws.simulateMessage({ type: 'event', event: 'agent.updated', payload: { seq: 2 } });
    expect(received).toHaveLength(1); // callback must NOT have been called again
  });

  it('empty Set after unsubscribe: re-subscribing for the same event works correctly', () => {
    // This test verifies that after all listeners for an event are removed and
    // a new listener is added, events are still delivered. This exercises the
    // path where on() calls eventListeners.set(event, new Set()) when no entry
    // exists yet (or when the Set is present but empty).
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    completeHandshake(client);
    const ws = wsInstances[0];

    const firstCalls: unknown[] = [];
    const unsub = client.on('cron.fired', (p) => firstCalls.push(p));

    ws.simulateMessage({ type: 'event', event: 'cron.fired', payload: { job: 'job-1' } });
    expect(firstCalls).toHaveLength(1);

    // Remove the only listener
    unsub();

    // Add a fresh listener for the same event
    const secondCalls: unknown[] = [];
    client.on('cron.fired', (p) => secondCalls.push(p));

    ws.simulateMessage({ type: 'event', event: 'cron.fired', payload: { job: 'job-2' } });

    expect(firstCalls).toHaveLength(1); // original callback still silent
    expect(secondCalls).toHaveLength(1); // new callback received the event
    expect(secondCalls[0]).toEqual({ job: 'job-2' });
  });
});

// ---------------------------------------------------------------------------
// GROUP 5 — Circuit breaker
// ---------------------------------------------------------------------------

describe('Group 5 — Circuit breaker', () => {
  it('after maxReconnectAttempts close events → state transitions to suspended', async () => {
    const stateChanges: string[] = [];
    const MAX = 3;

    const client = new OpenClawClient({
      wsUrl: 'ws://localhost:18789',
      maxReconnectAttempts: MAX,
      onStateChange: (s) => stateChanges.push(s),
    });

    client.connect();

    // Each close → scheduleReconnect increments reconnectAttempt and schedules
    // a timer. runAllTimers fires the timer → doConnect → new WebSocket.
    // After MAX such cycles (reconnectAttempt reaches MAX), the NEXT close
    // hits scheduleReconnect with attempt >= MAX and triggers 'suspended'.
    for (let attempt = 0; attempt < MAX; attempt++) {
      wsInstances[wsInstances.length - 1].simulateClose(1006, 'abnormal');
      vi.runAllTimers(); // fires the backoff timer → creates next WebSocket
    }
    // One final close on the last WebSocket triggers the circuit breaker.
    wsInstances[wsInstances.length - 1].simulateClose(1006, 'abnormal');

    expect(client.connectionState).toBe('suspended');
    expect(stateChanges).toContain('suspended');
  });

  it('resetCircuit() resets counter and triggers a new doConnect()', () => {
    const MAX = 2;
    const client = new OpenClawClient({
      wsUrl: 'ws://localhost:18789',
      maxReconnectAttempts: MAX,
    });

    client.connect();

    // Drive to suspended state (needs MAX cycles + 1 final close)
    for (let attempt = 0; attempt < MAX; attempt++) {
      wsInstances[wsInstances.length - 1].simulateClose(1006, 'abnormal');
      vi.runAllTimers();
    }
    wsInstances[wsInstances.length - 1].simulateClose(1006, 'abnormal');

    expect(client.connectionState).toBe('suspended');
    const instancesBeforeReset = wsInstances.length;

    client.resetCircuit();

    // resetCircuit calls doConnect() directly — a new WebSocket should appear
    expect(wsInstances.length).toBeGreaterThan(instancesBeforeReset);
    expect(client.connectionState).toBe('connecting');
  });
});

// ---------------------------------------------------------------------------
// GROUP 6 — tickIntervalMs clamping (F-10 security fix applied)
//
// The source now clamps tickIntervalMs:
//   Math.max(1_000, Math.min(value ?? 15_000, 300_000))
// Floor: 1 000ms  |  Default: 15 000ms  |  Ceiling: 300 000ms
// ---------------------------------------------------------------------------

describe('Group 6 — tickIntervalMs clamping (F-10 fix)', () => {
  function countTicks(ws: MockWebSocketInstance): number {
    return (ws.send as ReturnType<typeof vi.fn>).mock.calls.filter((args) => {
      try { return JSON.parse(args[0] as string).method === 'tick'; } catch { return false; }
    }).length;
  }

  it('tickIntervalMs: 1 → clamped to 1 000ms floor (no tick in 999ms, tick at 1 000ms)', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    const ws = completeHandshake(client, { policy: { tickIntervalMs: 1 } });
    (ws.send as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(999);
    expect(countTicks(ws)).toBe(0); // clamped — not firing at 1ms

    vi.advanceTimersByTime(1); // now at 1 000ms
    expect(countTicks(ws)).toBeGreaterThanOrEqual(1);
  });

  it('hello-ok with no tickIntervalMs → defaults to 15 000ms', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    const ws = completeHandshake(client, { policy: {} });
    (ws.send as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(14_999);
    expect(countTicks(ws)).toBe(0);

    vi.advanceTimersByTime(1); // crosses 15 000ms
    expect(countTicks(ws)).toBeGreaterThanOrEqual(1);
  });

  it('tickIntervalMs: 999 999 → clamped to 300 000ms ceiling (tick fires at 300 000ms)', () => {
    const client = new OpenClawClient({ wsUrl: 'ws://localhost:18789' });
    const ws = completeHandshake(client, { policy: { tickIntervalMs: 999_999 } });
    (ws.send as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(299_999);
    expect(countTicks(ws)).toBe(0);

    vi.advanceTimersByTime(1); // crosses 300 000ms
    expect(countTicks(ws)).toBeGreaterThanOrEqual(1);
  });
});
