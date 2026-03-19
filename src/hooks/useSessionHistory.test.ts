import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionHistory } from './useSessionHistory';
import { useConnectionStore } from '../store/connectionStore';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockClient(response: unknown = { messages: [] }) {
  return { call: vi.fn().mockResolvedValue(response) };
}

function setConnected(client: ReturnType<typeof makeMockClient>) {
  useConnectionStore.setState({ status: 'connected', client: client as never });
}

function setDisconnected() {
  useConnectionStore.setState({ status: 'disconnected', client: null });
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  setDisconnected();
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useSessionHistory', () => {
  // ── Null / disconnected guards ───────────────────────────────────────────

  describe('when sessionKey is null', () => {
    it('returns empty messages and historyLoading=false without calling client', async () => {
      const mockClient = makeMockClient();
      setConnected(mockClient);

      const { result } = renderHook(() => useSessionHistory(null));

      await waitFor(() => {
        expect(result.current.historyLoading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.hasMore).toBe(false);
      expect(mockClient.call).not.toHaveBeenCalled();
    });
  });

  describe('when status is disconnected', () => {
    it('returns empty messages and does not call client', async () => {
      // client is null and status is disconnected (set in beforeEach)
      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => {
        expect(result.current.historyLoading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
    });

    it('does not throw when client is null', () => {
      expect(() =>
        renderHook(() => useSessionHistory('agent:abc:main')),
      ).not.toThrow();
    });
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  describe('when connected with a valid sessionKey', () => {
    it('calls sessions.history with correct params', async () => {
      const mockClient = makeMockClient({ messages: [] });
      setConnected(mockClient);

      renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => {
        expect(mockClient.call).toHaveBeenCalledWith('sessions.history', {
          sessionKey: 'agent:abc:main',
          limit: 50,
          offset: 0,
        });
      });
    });

    it('maps messages shape correctly', async () => {
      const raw = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: '2026-03-18T10:00:00.000Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there',
          timestamp: '2026-03-18T10:00:01.000Z',
        },
      ];
      const mockClient = makeMockClient({ messages: raw });
      setConnected(mockClient);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => {
        expect(result.current.historyLoading).toBe(false);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toEqual({
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: '2026-03-18T10:00:00.000Z',
      });
      expect(result.current.messages[1]).toEqual({
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there',
        timestamp: '2026-03-18T10:00:01.000Z',
      });
    });
  });

  // ── Alternative response shape ───────────────────────────────────────────

  describe('response shape variants', () => {
    it('accepts { history: [...] } shape', async () => {
      const raw = [
        {
          id: 'h-1',
          role: 'system',
          content: 'System prompt',
          timestamp: '2026-03-18T09:00:00.000Z',
        },
      ];
      const mockClient = makeMockClient({ history: raw });
      setConnected(mockClient);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => expect(result.current.historyLoading).toBe(false));

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe('h-1');
      expect(result.current.messages[0].role).toBe('system');
    });

    it('falls back to empty array when response has neither messages nor history', async () => {
      const mockClient = makeMockClient({});
      setConnected(mockClient);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => expect(result.current.historyLoading).toBe(false));

      expect(result.current.messages).toEqual([]);
    });

    it('generates synthetic ids when id field is absent', async () => {
      const raw = [
        { role: 'user', content: 'No id here', timestamp: '2026-03-18T11:00:00.000Z' },
      ];
      const mockClient = makeMockClient({ messages: raw });
      setConnected(mockClient);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => expect(result.current.historyLoading).toBe(false));

      expect(result.current.messages[0].id).toBe('msg-0');
    });
  });

  // ── hasMore ──────────────────────────────────────────────────────────────

  describe('hasMore flag', () => {
    it('sets hasMore=true when exactly 50 messages are returned', async () => {
      const raw = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }));
      const mockClient = makeMockClient({ messages: raw });
      setConnected(mockClient);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => expect(result.current.historyLoading).toBe(false));

      expect(result.current.hasMore).toBe(true);
    });

    it('sets hasMore=false when fewer than 50 messages are returned', async () => {
      const raw = Array.from({ length: 49 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'assistant' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }));
      const mockClient = makeMockClient({ messages: raw });
      setConnected(mockClient);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => expect(result.current.historyLoading).toBe(false));

      expect(result.current.hasMore).toBe(false);
    });

    it('sets hasMore=false when 0 messages are returned', async () => {
      const mockClient = makeMockClient({ messages: [] });
      setConnected(mockClient);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => expect(result.current.historyLoading).toBe(false));

      expect(result.current.hasMore).toBe(false);
    });
  });

  // ── Error handling ───────────────────────────────────────────────────────

  describe('when RPC throws', () => {
    it('resets messages to [] and sets historyLoading=false without crashing', async () => {
      const mockClient = { call: vi.fn().mockRejectedValue(new Error('RPC failure')) };
      setConnected(mockClient as never);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      await waitFor(() => expect(result.current.historyLoading).toBe(false));

      expect(result.current.messages).toEqual([]);
      expect(result.current.loadingMore).toBe(false);
    });
  });

  // ── loadMore ─────────────────────────────────────────────────────────────

  describe('loadMore', () => {
    it('calls sessions.history with offset=50 and prepends results to existing messages', async () => {
      const firstPage = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user' as const,
        content: `Page1 message ${i}`,
        timestamp: new Date().toISOString(),
      }));
      const secondPage = Array.from({ length: 10 }, (_, i) => ({
        id: `old-${i}`,
        role: 'assistant' as const,
        content: `Page2 message ${i}`,
        timestamp: new Date().toISOString(),
      }));

      const mockClient = {
        call: vi
          .fn()
          .mockResolvedValueOnce({ messages: firstPage })
          .mockResolvedValueOnce({ messages: secondPage }),
      };
      setConnected(mockClient as never);

      const { result } = renderHook(() => useSessionHistory('agent:abc:main'));

      // Wait for first fetch to complete
      await waitFor(() => {
        expect(result.current.historyLoading).toBe(false);
        expect(result.current.messages).toHaveLength(50);
      });

      // Trigger loadMore
      act(() => {
        result.current.loadMore();
      });

      // Wait for second fetch
      await waitFor(() => {
        expect(result.current.loadingMore).toBe(false);
        expect(result.current.messages).toHaveLength(60);
      });

      // Second call must use offset=50
      expect(mockClient.call).toHaveBeenNthCalledWith(2, 'sessions.history', {
        sessionKey: 'agent:abc:main',
        limit: 50,
        offset: 50,
      });

      // Second page results are prepended (older messages come first in the list)
      expect(result.current.messages[0].id).toBe('old-0');
      expect(result.current.messages[10].id).toBe('msg-0');
    });
  });

  // ── sessionKey change ────────────────────────────────────────────────────

  describe('when sessionKey changes', () => {
    it('refetches with offset=0 and discards previous messages', async () => {
      const firstKeyMessages = [
        { id: 'a-1', role: 'user' as const, content: 'First session', timestamp: new Date().toISOString() },
      ];
      const secondKeyMessages = [
        { id: 'b-1', role: 'assistant' as const, content: 'Second session', timestamp: new Date().toISOString() },
      ];

      const mockClient = {
        call: vi
          .fn()
          .mockResolvedValueOnce({ messages: firstKeyMessages })
          .mockResolvedValueOnce({ messages: secondKeyMessages }),
      };
      setConnected(mockClient as never);

      const { result, rerender } = renderHook(
        ({ key }: { key: string }) => useSessionHistory(key),
        { initialProps: { key: 'agent:a:main' } },
      );

      await waitFor(() => {
        expect(result.current.historyLoading).toBe(false);
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].id).toBe('a-1');
      });

      // Change the session key
      rerender({ key: 'agent:b:main' });

      await waitFor(() => {
        expect(result.current.historyLoading).toBe(false);
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].id).toBe('b-1');
      });

      expect(mockClient.call).toHaveBeenCalledTimes(2);
      expect(mockClient.call).toHaveBeenLastCalledWith('sessions.history', {
        sessionKey: 'agent:b:main',
        limit: 50,
        offset: 0,
      });
    });
  });
});
