import { vi } from 'vitest';

export interface MockWebSocketInstance {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  simulateOpen: () => void;
  simulateMessage: (data: unknown) => void;
  simulateClose: (code?: number, reason?: string) => void;
  simulateError: () => void;
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
}

export function createMockWebSocket(): MockWebSocketInstance {
  const instance: MockWebSocketInstance = {
    send: vi.fn(),
    close: vi.fn(),
    readyState: WebSocket.CONNECTING,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    simulateOpen() {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    },
    simulateMessage(data: unknown) {
      const msg = typeof data === 'string' ? data : JSON.stringify(data);
      this.onmessage?.(new MessageEvent('message', { data: msg }));
    },
    simulateClose(code = 1000, reason = '') {
      this.readyState = WebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close', { code, reason, wasClean: code === 1000 }));
    },
    simulateError() {
      this.onerror?.(new Event('error'));
    },
  };
  return instance;
}

export function installMockWebSocket(): { instances: MockWebSocketInstance[]; restore: () => void } {
  const instances: MockWebSocketInstance[] = [];
  const OriginalWebSocket = global.WebSocket;

  // Use a regular function (not an arrow function) so it works as a constructor
  // when called with `new`. Vitest 4's vi.fn().mockImplementation(arrowFn) does
  // not invoke the arrow fn on `new` calls; a plain function constructor does.
  function MockWSConstructor(this: MockWebSocketInstance) {
    const inst = createMockWebSocket();
    instances.push(inst);
    // Copy all properties of inst onto `this` so the caller's `this.ws = new WebSocket(...)`
    // reference also has all the helpers.
    Object.assign(this, inst);
    return inst; // Returning an object from a constructor replaces `this`
  }

  // Copy static constants so code that reads WebSocket.OPEN etc. still works
  (MockWSConstructor as unknown as Record<string, number>).CONNECTING = 0;
  (MockWSConstructor as unknown as Record<string, number>).OPEN = 1;
  (MockWSConstructor as unknown as Record<string, number>).CLOSING = 2;
  (MockWSConstructor as unknown as Record<string, number>).CLOSED = 3;

  global.WebSocket = MockWSConstructor as unknown as typeof WebSocket;

  return {
    instances,
    restore: () => { global.WebSocket = OriginalWebSocket; },
  };
}
