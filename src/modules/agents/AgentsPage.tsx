import { useState, useCallback, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Send, Loader2, RotateCcw, ChevronUp } from 'lucide-react';
import { useAgentStore } from '../../store/agentStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useAuditStore } from '../../store/auditStore';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../hooks/useI18n';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import { useSessionHistory } from '../../hooks/useSessionHistory';
import { validateChatMessage, sanitizeText, CHAT_MAX_LENGTH } from '../../api/validation';
import { chatRateLimiter } from '../../api/rateLimiter';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { AgentStatusDot } from '../../components/ui/AgentStatusDot';
import GatewayEmptyState from '../../components/shared/GatewayEmptyState';
import DisconnectedOverlay from '../../components/shared/DisconnectedOverlay';
import AgentsIllustration from '../../components/shared/illustrations/AgentsIllustration';
import styles from './agents.module.css';

/* ── Page ────────────────────────────────────────── */

export default function AgentsPage() {
  const agents = useAgentStore((s) => s.agents);
  const selectedId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const selected = agents.find((a) => a.id === selectedId);

  const gwStatus = useConnectionStore((s) => s.status);
  const client = useConnectionStore((s) => s.client);
  const auditLog = useAuditStore((s) => s.log);
  const { theme } = useTheme();
  const toast = useToast();
  const { t } = useI18n('agents');
  const { t: tc } = useI18n();
  const timeAgo = useTimeAgo();

  const isDark = theme === 'dark';
  const chartColors = {
    accent:        isDark ? '#00E5FF' : '#007A99',
    tooltipBg:     isDark ? '#151B23' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(0,229,255,0.2)' : 'rgba(0,122,153,0.15)',
    label:         isDark ? '#8899AA' : '#6B7A8D',
  };

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedSessionKey = selected ? selected.id : null;
  const { messages: chatHistory, historyLoading, loadingMore, hasMore, loadMore, setMessages: setChatHistory } =
    useSessionHistory(selectedSessionKey);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, sending]);

  // Send a message
  const handleSend = useCallback(async (retryMsg?: { id: string; content: string; failed?: boolean }) => {
    const rawMsg = retryMsg ? retryMsg.content : chatInput.trim();
    if (!rawMsg || !selected || gwStatus !== 'connected' || !client) return;

    // Rate limit check (skip for retries to allow recovery)
    if (!retryMsg && !chatRateLimiter.tryConsume()) {
      toast.error(t('chat.rateLimited'));
      return;
    }

    // Input validation
    const validation = validateChatMessage(rawMsg);
    if (!validation.ok) {
      toast.error(t('chat.failed'));
      return;
    }
    const msg = sanitizeText(rawMsg);

    if (!retryMsg) setChatInput('');
    setSending(true);

    // If retrying, remove the failed message first
    if (retryMsg) {
      setChatHistory((prev) => prev.filter((m) => m.id !== retryMsg.id));
    }

    const userMsg = {
      id: `local-${Date.now()}`,
      role: 'user' as const,
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setChatHistory((prev) => [...prev, userMsg]);

    try {
      const res = await client.call<Record<string, unknown>>('chat.send', {
        sessionKey: selected.id,
        message: msg,
      });
      auditLog('chat.send', `agent:${selected.id} len:${msg.length}`);
      const reply = res as Record<string, unknown>;
      if (reply?.response || reply?.content || reply?.text) {
        const assistantMsg = {
          id: `reply-${Date.now()}`,
          role: 'assistant' as const,
          content: (reply.response ?? reply.content ?? reply.text ?? '') as string,
          timestamp: new Date().toISOString(),
        };
        setChatHistory((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      toast.error(t('chat.sendFailed', { message: err instanceof Error ? err.message : t('chat.unknownError') }));
      // Mark the user message as failed
      setChatHistory((prev) =>
        prev.map((m) => m.id === userMsg.id ? { ...m, failed: true } : m),
      );
    } finally {
      setSending(false);
    }
  }, [chatInput, selected, gwStatus, client, toast, auditLog, t, setChatHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isConnected = gwStatus === 'connected';

  const emptyState = (
    <GatewayEmptyState
      illustration={<AgentsIllustration />}
      headline={t('title')}
      description={t('subtitle')}
      features={[
        t('sessionHistory'),
        t('chat.inputPlaceholder'),
        t('overview.tokensToday'),
        `${t('status.active')}, ${t('status.idle')}, ${t('status.error')}`,
      ]}
    />
  );

  return (
    <DisconnectedOverlay connected={isConnected} emptyState={emptyState}>
    <div className={styles.agents}>
      {/* Left: Agent List */}
      <div className={styles.list}>
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`${styles.agentRow} ${
              selectedId === agent.id ? styles.agentRowSelected : ''
            } anim-fade-in-up`}
            onClick={() => selectAgent(agent.id)}
          >
            <AgentStatusDot status={agent.status} />
            <div className={styles.agentInfo}>
              <div className={styles.agentName}>{agent.name}</div>
              <div className={styles.agentRole}>{agent.role}</div>
            </div>
            <div className={styles.agentTokens}>
              {(agent.tokensUsedToday / 1000).toFixed(1)}K
            </div>
          </div>
        ))}
      </div>

      {/* Right: Detail Panel */}
      {selected ? (
        <div className={`${styles.detail} anim-slide-in-right`}>
          <div className={styles.detailHeader}>
            <AgentStatusDot status={selected.status} />
            <div>
              <div className={styles.detailName}>{selected.name}</div>
              <div className={styles.detailRole}>{selected.role}</div>
            </div>
          </div>

          {/* Stats */}
          <div className={styles.statRow}>
            <div className={styles.miniStat}>
              <div className={styles.miniStatLabel}>{t('overview.activeSession')}</div>
              <div className={styles.miniStatValue}>{selected.status}</div>
            </div>
            <div className={styles.miniStat}>
              <div className={styles.miniStatLabel}>{t('overview.tokensToday')}</div>
              <div className={styles.miniStatValue}>{(selected.tokensUsedToday / 1000).toFixed(1)}K</div>
            </div>
            <div className={styles.miniStat}>
              <div className={styles.miniStatLabel}>{t('overview.totalTokens')}</div>
              <div className={styles.miniStatValue}>{(selected.tokensUsedTotal / 1000).toFixed(0)}K</div>
            </div>
          </div>

          {/* Token Chart */}
          <div>
            <div className={styles.chartTitle}>{t('overview.totalTokens')} — 30 Days</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={selected.tokenHistory}>
                <defs>
                  <linearGradient id="agentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColors.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Tooltip
                  contentStyle={{
                    background: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: chartColors.label }}
                  itemStyle={{ color: chartColors.accent }}
                />
                <Area type="monotone" dataKey="tokens" stroke={chartColors.accent} fill="url(#agentGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Session Chat / Action Timeline */}
          <div className={styles.chatSection}>
            <div className={styles.chartTitle}>
              {isConnected && chatHistory.length > 0 ? t('sessionHistory') : t('overview.recentActions')}
            </div>

            <div className={styles.chatMessages}>
              {/* Load more button */}
              {isConnected && hasMore && (
                <button
                  className={styles.loadMoreBtn}
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? <><Loader2 size={12} className="anim-spin" /> {t('loadingHistory')}</>
                    : <><ChevronUp size={12} /> {t('loadEarlier')}</>
                  }
                </button>
              )}

              {/* Show session history if connected + has messages, else show actions */}
              {isConnected && chatHistory.length > 0 ? (
                <>
                  {historyLoading && (
                    <div className={styles.chatLoading}>
                      <Loader2 size={16} className="anim-spin" /> {t('loadingHistory')}
                    </div>
                  )}
                  {chatHistory.map((msg) => (
                    <div
                      key={msg.id}
                      className={`${styles.chatMsg} ${
                        msg.role === 'user' ? styles.chatMsgUser :
                        msg.role === 'assistant' ? styles.chatMsgAssistant :
                        styles.chatMsgSystem
                      } ${msg.failed ? styles.chatMsgFailed : ''}`}
                    >
                      <span className={styles.chatMsgRole}>{msg.role}</span>
                      <span className={styles.chatMsgContent}>
                        {msg.role === 'assistant'
                          ? <MarkdownRenderer content={msg.content} styles={styles} />
                          : msg.content
                        }
                      </span>
                      <div className={styles.chatMsgFooter}>
                        <span className={styles.chatMsgTime}>{timeAgo(msg.timestamp)}</span>
                        {msg.failed && (
                          <button
                            className={styles.retryBtn}
                            onClick={() => handleSend(msg)}
                            title={t('chat.retry')}
                          >
                            <RotateCcw size={11} /> {t('chat.retry')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {sending && (
                    <div className={`${styles.chatMsg} ${styles.chatMsgAssistant} ${styles.chatMsgTyping}`}>
                      <span className={styles.chatMsgRole}>assistant</span>
                      <span className={styles.typingDots}>
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.timeline}>
                  {selected.actions.map((action) => (
                    <div
                      key={action.id}
                      className={`${styles.timelineItem} ${
                        action.type === 'task' ? styles.timelineTask :
                        action.type === 'cron' ? styles.timelineCron :
                        action.type === 'api_call' ? styles.timelineApiCall :
                        action.type === 'error' ? styles.timelineError :
                        styles.timelineInfo
                      }`}
                    >
                      <div className={styles.timelineTime}>
                        {timeAgo(action.timestamp)}
                      </div>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineDesc}>{action.description}</div>
                        <div className={styles.timelineMeta}>
                          {action.tokensUsed && `${action.tokensUsed} tokens`}
                          {action.duration && ` · ${action.duration}s`}
                        </div>
                      </div>
                    </div>
                  ))}
                  {selected.actions.length === 0 && (
                    <div className={styles.chatEmpty}>{t('noRecentActions')}</div>
                  )}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input — only when connected */}
            {isConnected && (
              <div className={styles.chatInputWrapper}>
                <div className={styles.chatInputRow}>
                  <input
                    className={styles.chatInput}
                    type="text"
                    placeholder={t('chat.inputPlaceholder')}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value.slice(0, CHAT_MAX_LENGTH))}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                    maxLength={CHAT_MAX_LENGTH}
                  />
                  <button
                    className={styles.chatSendBtn}
                    onClick={() => handleSend()}
                    disabled={sending || !chatInput.trim()}
                    title={tc('accessibility.sendMessage')}
                  >
                    {sending ? <Loader2 size={16} className="anim-spin" /> : <Send size={16} />}
                  </button>
                </div>
                {chatInput.length > CHAT_MAX_LENGTH * 0.8 && (
                  <div className={`${styles.charCount} ${chatInput.length >= CHAT_MAX_LENGTH ? styles.charCountLimit : ''}`}>
                    {t('chat.charCount', { count: chatInput.length })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.detail}>
          <div className={styles.noSelection}>
            {t('selectAgent')}
          </div>
        </div>
      )}
    </div>
    </DisconnectedOverlay>
  );
}
