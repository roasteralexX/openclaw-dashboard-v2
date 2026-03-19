import { create } from 'zustand';
import type { Agent } from '../types';
import { getGatewayClient } from '../api/gatewayGuard';

interface AgentStore {
  agents: Agent[];
  loading: boolean;
  selectedAgentId: string | null;
  selectAgent: (id: string | null) => void;
  getAgent: (id: string) => Agent | undefined;
  fetchAgents: () => Promise<void>;
}

/**
 * Maps OpenClaw gateway session/channel data to our Agent type.
 */
function mapSessionsToAgents(
  sessions: Record<string, unknown>[],
  channels: Record<string, unknown>,
): Agent[] {
  if (!sessions.length) return [];

  return sessions.map((s, i) => {
    const session = s as Record<string, unknown>;
    const key = (session.sessionKey ?? session.key ?? `session-${i}`) as string;
    const channel = (session.channel ?? 'unknown') as string;
    const channelInfo = (channels as Record<string, Record<string, unknown>>)?.[channel];
    const channelStatus = (channelInfo?.status ?? 'disconnected') as string;

    const status: Agent['status'] =
      channelStatus === 'connected' ? 'active'
      : channelStatus === 'error' ? 'error'
      : 'idle';

    return {
      id: key,
      name: (session.agentName ?? session.agent ?? channel ?? key) as string,
      role: (session.role ?? channel) as string,
      status,
      lastAction: (session.lastMessage ?? '') as string,
      lastActionTime: (session.lastMessageAt ?? session.updatedAt ?? '') as string,
      tokensUsedToday: (session.tokensToday ?? 0) as number,
      tokensUsedTotal: (session.tokensTotal ?? 0) as number,
      actions: [],
      tokenHistory: [],
    };
  });
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  loading: false,
  selectedAgentId: null,
  selectAgent: (id) => set({ selectedAgentId: id }),
  getAgent: (id) => get().agents.find((a) => a.id === id),

  fetchAgents: async () => {
    const gw = getGatewayClient();
    if (!gw) return;

    set({ loading: true });
    try {
      const [sessionsRes, channelsRes] = await Promise.all([
        gw.client.call<{ sessions?: Record<string, unknown>[] }>('sessions.list'),
        gw.client.call<Record<string, unknown>>('channels.status'),
      ]);

      const sessions = (sessionsRes as Record<string, unknown>)?.sessions
        ?? (Array.isArray(sessionsRes) ? sessionsRes : []);
      const channels = channelsRes ?? {};

      const agents = mapSessionsToAgents(
        sessions as Record<string, unknown>[],
        channels,
      );

      set({ agents, loading: false });
    } catch (err) {
      console.warn('[AgentStore] Failed to fetch from gateway:', err);
      set({ agents: [], loading: false });
    }
  },
}));
