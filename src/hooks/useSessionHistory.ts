import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useConnectionStore } from '../store/connectionStore';

/* ── Types ───────────────────────────────────────── */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  failed?: boolean;
  runId?: string;
}

/* ── Constants ───────────────────────────────────── */

const HISTORY_LIMIT = 50;

/* ── Hook ────────────────────────────────────────── */

interface UseSessionHistoryReturn {
  messages: ChatMessage[];
  historyLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  fetchHistory: (offset?: number) => Promise<void>;
  loadMore: () => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

export function useSessionHistory(sessionKey: string | null): UseSessionHistoryReturn {
  const status = useConnectionStore((s) => s.status);
  const client = useConnectionStore((s) => s.client);

  const [messages, setMessages]             = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [hasMore, setHasMore]               = useState(false);
  const [offset, setOffset]                 = useState(0);

  const fetchHistory = useCallback(async (fetchOffset = 0) => {
    if (!sessionKey || status !== 'connected' || !client) {
      if (fetchOffset === 0) setMessages([]);
      return;
    }

    if (fetchOffset === 0) setHistoryLoading(true);
    else setLoadingMore(true);

    try {
      const res = await client.call<Record<string, unknown>>('sessions.history', {
        sessionKey,
        limit: HISTORY_LIMIT,
        offset: fetchOffset,
      });

      const raw = (res as Record<string, unknown>)?.messages
        ?? (res as Record<string, unknown>)?.history
        ?? (Array.isArray(res) ? res : []);

      const mapped = (raw as Record<string, unknown>[]).map((m, i) => ({
        id:        (m.id ?? `msg-${fetchOffset + i}`) as string,
        role:      (m.role ?? 'system') as ChatMessage['role'],
        content:   (m.content ?? m.text ?? '') as string,
        timestamp: (m.timestamp ?? m.createdAt ?? new Date().toISOString()) as string,
      }));

      setHasMore(mapped.length === HISTORY_LIMIT);

      if (fetchOffset === 0) {
        setMessages(mapped);
      } else {
        setMessages((prev) => [...mapped, ...prev]);
      }
    } catch {
      if (fetchOffset === 0) setMessages([]);
    } finally {
      if (fetchOffset === 0) setHistoryLoading(false);
      else setLoadingMore(false);
    }
  }, [sessionKey, status, client]);

  // Auto-fetch when sessionKey or connection status changes
  useEffect(() => {
    setOffset(0);
    setHasMore(false);
    fetchHistory(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, status]);

  const loadMore = useCallback(() => {
    const nextOffset = offset + HISTORY_LIMIT;
    setOffset(nextOffset);
    fetchHistory(nextOffset);
  }, [fetchHistory, offset]);

  return {
    messages,
    historyLoading,
    loadingMore,
    hasMore,
    fetchHistory,
    loadMore,
    setMessages,
  };
}
