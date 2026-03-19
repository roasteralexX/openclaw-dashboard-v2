import {
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  Send,
  Square,
  Loader2,
  RotateCcw,
  ChevronUp,
  Search,
  MessageSquare,
  Copy,
  Check,
} from 'lucide-react';
import { useAgentStore } from '../../store/agentStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useAuditStore } from '../../store/auditStore';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import { useSessionHistory } from '../../hooks/useSessionHistory';
import type { ChatMessage } from '../../hooks/useSessionHistory';
import { validateChatMessage, sanitizeText, CHAT_MAX_LENGTH } from '../../api/validation';
import { chatRateLimiter } from '../../api/rateLimiter';
import { apiFetch } from '../../api/apiFetch';
import GatewayEmptyState from '../../components/shared/GatewayEmptyState';
import ChatIllustration from '../../components/shared/illustrations/ChatIllustration';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { AgentStatusDot } from '../../components/ui/AgentStatusDot';
import type { Agent } from '../../types';
import styles from './chat.module.css';

/* ── Types ───────────────────────────────────────── */

interface StreamRef {
  active: boolean;
  sessionKey: string | null;
  runId: string | null;
  buffer: string;
}

/* ── Helpers ─────────────────────────────────────── */

const MAX_TEXTAREA_HEIGHT = 144; // ~6 lines

/* ── SQLite API helpers ──────────────────────────── */

async function fetchMessagesFromDb(sessionKey: string): Promise<ChatMessage[]> {
  try {
    const res = await apiFetch(`/api/chat/messages/${encodeURIComponent(sessionKey)}`);
    if (!res.ok) return [];
    return (await res.json()) as ChatMessage[];
  } catch {
    return [];
  }
}

function persistMessage(msg: ChatMessage, sessionKey: string): void {
  apiFetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...msg, sessionKey }),
  }).catch(() => {});
}

/* ── Page ────────────────────────────────────────── */

export default function ChatPage() {
  const agents    = useAgentStore((s) => s.agents);
  const selectedId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const selected  = agents.find((a) => a.id === selectedId) ?? null;

  const status    = useConnectionStore((s) => s.status);
  const client    = useConnectionStore((s) => s.client);
  const auditLog  = useAuditStore((s) => s.log);
  const toast     = useToast();
  const { t }     = useI18n('chat');

  const isConnected = status === 'connected';

  // ── Agent search ───────────────────────────────
  const [search, setSearch] = useState('');
  const filteredAgents = search.trim()
    ? agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : agents;

  // ── Session history ────────────────────────────
  const selectedKey = selected ? `agent:${selected.id}:main` : null;
  const { messages, setMessages, historyLoading, loadingMore, hasMore, loadMore } =
    useSessionHistory(selectedKey);

  // ── Stream state (two-layer: ref + state) ──────
  const streamRef  = useRef<StreamRef>({ active: false, sessionKey: null, runId: null, buffer: '' });
  const rafHandle  = useRef<number | null>(null);
  const selectedKeyRef = useRef<string | null>(null);
  const [isStreaming, setIsStreaming]  = useState(false);
  const [streamContent, setStreamContent] = useState('');

  // ── Input state ────────────────────────────────
  const [chatInput, setChatInput]     = useState('');
  const [rateTokens, setRateTokens]   = useState(() => Math.floor(chatRateLimiter.available));
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  // ── Scroll refs ────────────────────────────────
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp       = useRef(false);
  const textareaRef          = useRef<HTMLTextAreaElement>(null);

  // ── Rate limit ticker ──────────────────────────
  useEffect(() => {
    const id = setInterval(() => setRateTokens(Math.floor(chatRateLimiter.available)), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Keep selectedKeyRef in sync ────────────────
  useEffect(() => {
    selectedKeyRef.current = selected?.id ?? null;
  }, [selected?.id]);

  // ── Reset streaming state on agent change ──────
  useEffect(() => {
    setIsStreaming(false);
    setStreamContent('');
    streamRef.current = { active: false, sessionKey: null, runId: null, buffer: '' };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, isConnected]);

  // ── Streaming flush ────────────────────────────
  function flushStream() {
    if (rafHandle.current !== null) return;
    rafHandle.current = requestAnimationFrame(() => {
      rafHandle.current = null;
      setStreamContent(streamRef.current.buffer);
    });
  }

  // ── Event handlers ─────────────────────────────
  const handleStarted = useCallback((payload: unknown) => {
    const d = payload as { sessionKey: string; runId: string };
    if (d.sessionKey !== selectedKeyRef.current) return;
    streamRef.current = { active: true, sessionKey: d.sessionKey, runId: d.runId, buffer: '' };
    setIsStreaming(true);
    setStreamContent('');
  }, []);

  const handleDelta = useCallback((payload: unknown) => {
    const d = payload as { sessionKey: string; delta: string; runId: string };
    if (d.sessionKey !== selectedKeyRef.current) return;
    if (!streamRef.current.active) {
      streamRef.current = { active: true, sessionKey: d.sessionKey, runId: d.runId, buffer: '' };
      setIsStreaming(true);
    }
    streamRef.current.buffer += d.delta;
    flushStream();
  }, []);

  const handleFinal = useCallback((payload: unknown) => {
    const d = payload as { sessionKey: string; content: string; runId: string };
    if (d.sessionKey !== selectedKeyRef.current) return;

    if (rafHandle.current !== null) {
      cancelAnimationFrame(rafHandle.current);
      rafHandle.current = null;
    }
    streamRef.current = { active: false, sessionKey: null, runId: null, buffer: '' };
    setIsStreaming(false);
    setStreamContent('');

    const assistantMsg: ChatMessage = {
      id: `final-${Date.now()}`,
      role: 'assistant',
      content: d.content,
      timestamp: new Date().toISOString(),
      runId: d.runId,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    if (selectedKeyRef.current) {
      persistMessage(assistantMsg, `agent:${selectedKeyRef.current}:main`);
    }
  }, [setMessages]);

  // ── Subscribe to streaming events ─────────────
  useEffect(() => {
    if (status !== 'connected' || !client) return;

    const unsubs = [
      client.on('chat.started', handleStarted),
      client.on('chat.delta',   handleDelta),
      client.on('chat.final',   handleFinal),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
      if (rafHandle.current !== null) {
        cancelAnimationFrame(rafHandle.current);
        rafHandle.current = null;
      }
    };
  }, [client, status, handleStarted, handleDelta, handleFinal]);

  // ── Fetch local SQLite history on agent change ─
  useEffect(() => {
    if (!selected) return;
    fetchMessagesFromDb(`agent:${selected.id}:main`).then((local) => {
      if (local.length > 0) {
        setMessages(local);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // ── Send message ───────────────────────────────
  const handleSend = useCallback(async (text: string, retryMsg?: ChatMessage) => {
    const raw = retryMsg ? retryMsg.content : text.trim();
    if (!raw || !selected || !isConnected || !client) return;

    // Rate limit (skip on retries)
    if (!retryMsg && !chatRateLimiter.tryConsume()) {
      toast.error(t('input.rateLimited'));
      return;
    }

    // Validation
    if (!validateChatMessage(raw).ok) {
      toast.error(t('message.failed'));
      return;
    }

    const msg = sanitizeText(raw);

    if (!retryMsg) {
      setChatInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== retryMsg.id));
    }

    userScrolledUp.current = false;

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage(userMsg, `agent:${selected.id}:main`);
    setIsStreaming(true);
    streamRef.current = { active: true, sessionKey: selected.id, runId: null, buffer: '' };

    // Fallback timeout: if chat.final never fires within 30s, use call() return value
    const fallbackTimer = setTimeout(() => {
      if (!streamRef.current.active) return;
      if (streamRef.current.buffer) {
        const content = streamRef.current.buffer;
        streamRef.current = { active: false, sessionKey: null, runId: null, buffer: '' };
        setIsStreaming(false);
        setStreamContent('');
        setMessages((prev) => [
          ...prev,
          { id: `fallback-${Date.now()}`, role: 'assistant', content, timestamp: new Date().toISOString() },
        ]);
      } else {
        streamRef.current = { active: false, sessionKey: null, runId: null, buffer: '' };
        setIsStreaming(false);
        setStreamContent('');
      }
    }, 30_000);

    try {
      const res = await client.call<Record<string, unknown>>('chat.send', {
        sessionKey: selected.id,
        message: msg,
      });
      auditLog('chat.send', `agent:${selected.id} len:${msg.length}`);

      // Non-streaming fallback: use return value if no delta events arrived
      const reply = res as Record<string, unknown>;
      if ((reply?.response || reply?.content || reply?.text) && !streamRef.current.active) {
        clearTimeout(fallbackTimer);
        setIsStreaming(false);
        setStreamContent('');
        const replyMsg: ChatMessage = {
          id: `reply-${Date.now()}`,
          role: 'assistant',
          content: (reply.response ?? reply.content ?? reply.text ?? '') as string,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, replyMsg]);
        persistMessage(replyMsg, `agent:${selected.id}:main`);
      }
    } catch (err) {
      clearTimeout(fallbackTimer);
      streamRef.current = { active: false, sessionKey: null, runId: null, buffer: '' };
      setIsStreaming(false);
      setStreamContent('');
      toast.error(t('message.sendFailed', {
        message: err instanceof Error ? err.message : t('message.unknownError'),
      }));
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m))
      );
    } finally {
      clearTimeout(fallbackTimer);
    }
  }, [selected, isConnected, client, auditLog, toast, t, setMessages]);

  // ── Abort ──────────────────────────────────────
  const handleAbort = useCallback(async () => {
    if (!selected || !client || !isConnected) return;
    try {
      await client.call('chat.abort', { sessionKey: selected.id });
    } catch {
      // Ignore — stream state cleanup is sufficient
    } finally {
      if (rafHandle.current !== null) {
        cancelAnimationFrame(rafHandle.current);
        rafHandle.current = null;
      }
      streamRef.current = { active: false, sessionKey: null, runId: null, buffer: '' };
      setIsStreaming(false);
      setStreamContent('');
    }
  }, [selected, client, isConnected]);

  // ── Copy message ───────────────────────────────
  const handleCopy = useCallback(async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error(t('message.failed'));
    }
  }, [toast, t]);

  // ── Textarea auto-resize ───────────────────────
  function handleTextareaChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    setChatInput(e.target.value.slice(0, CHAT_MAX_LENGTH));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.trim() && !isStreaming) {
        handleSend(chatInput);
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setChatInput('');
      e.currentTarget.style.height = 'auto';
    }
  }

  // ── Scroll detection + auto-scroll ────────────
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    userScrolledUp.current = (el.scrollHeight - el.scrollTop - el.clientHeight) > 80;
  }

  useEffect(() => {
    if (!userScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamContent]);

  // ── Char counter class ─────────────────────────
  const charCountClass =
    chatInput.length >= CHAT_MAX_LENGTH
      ? styles.charCountLimit
      : chatInput.length > CHAT_MAX_LENGTH * 0.8
      ? styles.charCountWarn
      : styles.charCount;

  /* ── Render ─────────────────────────────────────── */
  return (
    <div className={styles.chatPage}>

      {/* ── LEFT: Agent List ── */}
      <div className={styles.agentList}>
        <div className={styles.agentListHeader}>
          <div className={styles.agentListTitle}>{t('title')}</div>
          <div className={styles.agentListSearch}>
            <Search size={12} className={styles.agentListSearchIcon} />
            <input
              className={styles.agentListSearchInput}
              placeholder={t('agentList.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.agentListScroll}>
          {filteredAgents.length === 0 ? (
            <div className={styles.agentListEmpty}>
              {search.trim()
                ? t('agentList.noMatch', { query: search })
                : t('agentList.empty')}
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <AgentListItem
                key={agent.id}
                agent={agent}
                selected={selectedId === agent.id}
                onSelect={() => selectAgent(agent.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── CENTER: Conversation ── */}
      <div className={styles.conversation}>
        {!isConnected ? (
          <GatewayEmptyState
            illustration={<ChatIllustration />}
            headline={t('disconnected.headline')}
            description={t('disconnected.description')}
            features={[
              t('conversation.streaming'),
              t('conversation.loadEarlier'),
              t('conversation.stopGenerating'),
              t('agentList.searchPlaceholder'),
            ]}
          />
        ) : (
          <>
            {/* Header */}
            <div className={styles.convHeader}>
              {selected ? (
                <>
                  <AgentStatusDot status={selected.status} />
                  <div>
                    <div className={styles.convHeaderName}>{selected.name}</div>
                    <div className={styles.convHeaderRole}>{selected.role}</div>
                  </div>
                  <div className={styles.convHeaderStatus}>
                    {isStreaming && (
                      <span className={styles.convHeaderStreaming}>
                        <Loader2 size={12} style={{ display: 'inline', animation: 'spin 1s linear infinite' }} />
                        {' '}{t('conversation.streaming')}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.convHeaderName} style={{ color: 'var(--c-text-muted)', fontWeight: 400 }}>
                  {t('noAgentSelected')}
                </div>
              )}
            </div>

            {/* Messages */}
            <div
              className={styles.convMessages}
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {/* Load earlier */}
              {selected && hasMore && (
                <button
                  className={styles.loadEarlierBtn}
                  onClick={loadMore}
                  disabled={loadingMore || isStreaming}
                >
                  {loadingMore
                    ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> {t('conversation.loadingHistory')}</>
                    : <><ChevronUp size={12} /> {t('conversation.loadEarlier')}</>
                  }
                </button>
              )}

              {/* History loading */}
              {historyLoading && (
                <div className={styles.convEmpty} style={{ flex: 'none' }}>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--c-accent-500)' }} />
                  {t('conversation.loadingHistory')}
                </div>
              )}

              {/* Empty state */}
              {!historyLoading && selected && messages.length === 0 && !isStreaming && (
                <div className={styles.convEmpty}>
                  <MessageSquare size={32} className={styles.convEmptyIcon} />
                  {t('conversation.historyEmpty')}
                </div>
              )}

              {/* No agent selected */}
              {!selected && (
                <div className={styles.convEmpty}>
                  <MessageSquare size={32} className={styles.convEmptyIcon} />
                  {t('noAgentSelected')}
                </div>
              )}

              {/* Message list */}
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onRetry={handleSend}
                  onCopy={handleCopy}
                  copied={copiedId === msg.id}
                />
              ))}

              {/* Streaming bubble */}
              {isStreaming && streamContent && (
                <div className={styles.msgWrapperAssistant}>
                  <div className={`${styles.msgBubble} ${styles.msgStreaming}`}>
                    <MarkdownRenderer content={streamContent} styles={styles} />
                    <span className={styles.streamCursor} aria-hidden="true" />
                  </div>
                </div>
              )}

              {/* Typing dots when streaming started but no content yet */}
              {isStreaming && !streamContent && (
                <div className={styles.msgWrapperAssistant}>
                  <div className={`${styles.msgBubble} ${styles.msgAssistant}`}>
                    <span style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--ff-mono)' }}>
                      {t('conversation.streaming')}
                    </span>
                    <span className={styles.streamCursor} aria-hidden="true" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className={styles.convInputArea}>
              <div className={styles.inputRow}>
                <textarea
                  ref={textareaRef}
                  className={styles.chatTextarea}
                  rows={1}
                  placeholder={
                    selected
                      ? t('input.placeholder', { agentName: selected.name })
                      : t('input.placeholderDefault')
                  }
                  value={chatInput}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  disabled={!selected || isStreaming}
                  maxLength={CHAT_MAX_LENGTH}
                />

                {isStreaming ? (
                  <button
                    className={styles.abortBtn}
                    onClick={handleAbort}
                    title={t('conversation.stopGenerating')}
                  >
                    <Square size={14} />
                  </button>
                ) : (
                  <button
                    className={styles.sendBtn}
                    onClick={() => handleSend(chatInput)}
                    disabled={!selected || !chatInput.trim()}
                    title={t('input.send')}
                  >
                    <Send size={14} />
                  </button>
                )}
              </div>

              <div className={styles.inputMeta}>
                <span className={charCountClass}>
                  {t('input.charCount', { count: chatInput.length })}
                </span>
                <div
                  className={styles.rateDots}
                  title={t('input.rateLimitTitle', { count: rateTokens })}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`${styles.rateDot} ${i < rateTokens ? styles.rateDotFull : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Agent Info ── */}
      <div className={styles.agentInfoPanel}>
        {selected ? (
          <AgentInfoPanel
            agent={selected}
            isStreaming={isStreaming}
            onAbort={handleAbort}
          />
        ) : (
          <div className={styles.noAgentPanel}>
            <MessageSquare size={28} className={styles.noAgentIcon} />
            {t('noAgentSelected')}
          </div>
        )}
      </div>

    </div>
  );
}

/* ── Sub-components ──────────────────────────────── */

interface AgentListItemProps {
  agent: Agent;
  selected: boolean;
  onSelect: () => void;
}

const AgentListItem = memo(function AgentListItem({ agent, selected, onSelect }: AgentListItemProps) {
  const { t } = useI18n('chat');
  const lastAction = agent.actions[agent.actions.length - 1];
  const statusKey = `status.${agent.status}` as 'status.active' | 'status.idle' | 'status.error' | 'status.offline';

  return (
    <div
      className={`${styles.agentItem} ${selected ? styles.agentItemSelected : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <AgentStatusDot status={agent.status} />
      <div className={styles.agentItemInfo}>
        <div className={styles.agentItemName}>{agent.name}</div>
        <div className={styles.agentItemPreview}>
          {lastAction ? lastAction.description : t(statusKey)}
        </div>
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--ff-mono)', color: 'var(--c-text-muted)', flexShrink: 0 }}>
        {(agent.tokensUsedToday / 1000).toFixed(1)}K
      </div>
    </div>
  );
});

interface MessageBubbleProps {
  msg: ChatMessage;
  onRetry: (text: string, msg: ChatMessage) => Promise<void>;
  onCopy: (id: string, content: string) => Promise<void>;
  copied: boolean;
}

const MessageBubble = memo(function MessageBubble({ msg, onRetry, onCopy, copied }: MessageBubbleProps) {
  const { t } = useI18n('chat');
  const timeAgo = useTimeAgo();

  if (msg.role === 'system') {
    return (
      <div className={styles.msgWrapperSystem}>
        <div className={`${styles.msgBubble} ${styles.msgSystem}`}>
          {msg.content}
        </div>
      </div>
    );
  }

  const isUser = msg.role === 'user';

  return (
    <div className={isUser ? styles.msgWrapperUser : styles.msgWrapperAssistant}>
      <div className={`${styles.msgBubble} ${isUser ? styles.msgUser : styles.msgAssistant} ${msg.failed ? styles.msgFailed : ''}`}>

        {/* Hover actions */}
        <div className={styles.msgActions}>
          <button
            className={styles.msgActionBtn}
            onClick={() => onCopy(msg.id, msg.content)}
            title={t('message.copy')}
          >
            {copied
              ? <><Check size={10} /> {t('message.copied')}</>
              : <><Copy size={10} /> {t('message.copy')}</>
            }
          </button>
        </div>

        {/* Content */}
        {isUser
          ? msg.content
          : <MarkdownRenderer content={msg.content} styles={styles} />
        }
      </div>

      <div className={styles.msgTime} title={new Date(msg.timestamp).toLocaleString()}>
        {timeAgo(msg.timestamp)}
      </div>

      {/* Retry on failure */}
      {msg.failed && (
        <button
          className={styles.msgRetryBtn}
          onClick={() => onRetry(msg.content, msg)}
        >
          <RotateCcw size={11} /> {t('message.retry')}
        </button>
      )}
    </div>
  );
});

interface AgentInfoPanelProps {
  agent: Agent;
  isStreaming: boolean;
  onAbort: () => Promise<void>;
}

function AgentInfoPanel({ agent, isStreaming, onAbort }: AgentInfoPanelProps) {
  const { t } = useI18n('chat');
  const { t: tc } = useI18n();

  const statusColor =
    agent.status === 'active' ? 'var(--c-success)' :
    agent.status === 'error'  ? 'var(--c-error)'   :
    agent.status === 'idle'   ? 'var(--c-warn-400)' :
    'var(--c-text-muted)';

  const statusKey = `status.${agent.status}` as 'status.active' | 'status.idle' | 'status.error' | 'status.offline';

  return (
    <>
      <div className={styles.infoSectionTitle}>{t('agentInfo.title')}</div>

      <div className={styles.infoStat}>
        <span className={styles.infoStatLabel}>{t('agentInfo.status')}</span>
        <span className={styles.infoStatValue} style={{ color: statusColor }}>
          {t(statusKey)}
        </span>
      </div>

      <div className={styles.infoStatGrid}>
        <div className={styles.infoStat}>
          <span className={styles.infoStatLabel}>{t('agentInfo.tokensToday')}</span>
          <span className={`${styles.infoStatValue} ${styles.infoStatAccent}`}>
            {(agent.tokensUsedToday / 1000).toFixed(1)}K
          </span>
        </div>
        <div className={styles.infoStat}>
          <span className={styles.infoStatLabel}>{t('agentInfo.tokensTotal')}</span>
          <span className={styles.infoStatValue}>
            {(agent.tokensUsedTotal / 1000).toFixed(0)}K
          </span>
        </div>
      </div>

      <div className={styles.infoStat}>
        <span className={styles.infoStatLabel}>{t('agentInfo.model')}</span>
        <span className={styles.infoStatValue}>
          {agent.role || t('agentInfo.unknown')}
        </span>
      </div>

      <div className={styles.infoDivider} />

      <div className={styles.infoSectionTitle} style={{ marginBottom: 'var(--sp-2)' }}>
        {t('agentInfo.sessionStarted')}
      </div>

      <div className={styles.infoStat}>
        <span className={styles.infoStatLabel}>{tc('time.justNow')}</span>
        <span className={styles.infoStatValue} style={{ color: 'var(--c-text-muted)' }}>
          {agent.lastActionTime
            ? new Date(agent.lastActionTime).toLocaleTimeString()
            : t('agentInfo.noSession')}
        </span>
      </div>

      <div className={styles.infoDivider} />

      <button
        className={`${styles.infoActionBtn} ${styles.infoActionAbort}`}
        onClick={onAbort}
        disabled={!isStreaming}
        title={t('agentInfo.abortRun')}
      >
        <Square size={12} />
        {t('agentInfo.abortRun')}
      </button>
    </>
  );
}
