import { useEffect, useRef } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { useAgentStore } from '../store/agentStore';
import { useCronStore } from '../store/cronStore';
import { useEventStore } from '../store/eventStore';
import { useBoardStore } from '../store/boardStore';
import type { Ticket } from '../types';

/**
 * Hook that subscribes to OpenClaw gateway events when connected
 * and dispatches updates to the appropriate stores.
 *
 * Mount this once at the app root level.
 */
export function useGatewayEvents() {
  const client = useConnectionStore((s) => s.client);
  const status = useConnectionStore((s) => s.status);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    // Clean up previous subscriptions
    cleanupRef.current.forEach((unsub) => unsub());
    cleanupRef.current = [];

    if (status !== 'connected' || !client) return;

    const unsubs: (() => void)[] = [];
    const pushEvent = useEventStore.getState().pushEvent;

    // Bootstrap board data on connect
    useBoardStore.getState().fetchTickets();

    // ── system-presence → update agent status ──────────────
    unsubs.push(
      client.on('system-presence', (payload) => {
        pushEvent('system-presence', payload);
        const data = payload as Record<string, unknown>;
        const agentId = (data.sessionKey ?? data.agent ?? data.peerId) as string | undefined;
        const presenceStatus = data.status as string | undefined;

        if (agentId && presenceStatus) {
          useAgentStore.setState((s) => ({
            agents: s.agents.map((a) =>
              a.id === agentId
                ? {
                    ...a,
                    status:
                      presenceStatus === 'online' || presenceStatus === 'connected'
                        ? 'active'
                        : presenceStatus === 'error'
                        ? 'error'
                        : 'idle',
                  }
                : a,
            ),
          }));
        }
      }),
    );

    // ── channels.status → update channel-based agent statuses ──
    unsubs.push(
      client.on('channels.status', (payload) => {
        pushEvent('channels.status', payload);
        // Refetch agents since channels affect agent status
        useAgentStore.getState().fetchAgents();
      }),
    );

    // ── cron.* events → update cron data ───────────────────
    const cronEvents = [
      'cron.started',
      'cron.completed',
      'cron.failed',
      'cron.enabled',
      'cron.disabled',
    ];

    cronEvents.forEach((eventName) => {
      unsubs.push(
        client.on(eventName, (payload) => {
          pushEvent(eventName, payload);
          const data = payload as Record<string, unknown>;
          const cronId = data.id as string | undefined;

          if (eventName === 'cron.enabled' || eventName === 'cron.disabled') {
            // Toggle the enabled state optimistically
            if (cronId) {
              useCronStore.setState((s) => ({
                crons: s.crons.map((c) =>
                  c.id === cronId
                    ? { ...c, enabled: eventName === 'cron.enabled' }
                    : c,
                ),
              }));
            }
          } else if (eventName === 'cron.started') {
            // Mark a cron as currently running
            if (cronId) {
              useCronStore.setState((s) => ({
                crons: s.crons.map((c) =>
                  c.id === cronId
                    ? {
                        ...c,
                        executions: [
                          {
                            id: (data.runId ?? `run-${Date.now()}`) as string,
                            startTime: new Date().toISOString(),
                            status: 'running' as const,
                          },
                          ...c.executions,
                        ],
                      }
                    : c,
                ),
              }));
            }
          } else if (eventName === 'cron.completed' || eventName === 'cron.failed') {
            // Update the execution status
            if (cronId) {
              const runId = data.runId as string | undefined;
              useCronStore.setState((s) => ({
                crons: s.crons.map((c) => {
                  if (c.id !== cronId) return c;
                  return {
                    ...c,
                    lastRun: new Date().toISOString(),
                    executions: c.executions.map((e) =>
                      e.id === runId || (e.status === 'running' && c.id === cronId)
                        ? {
                            ...e,
                            status: (eventName === 'cron.completed' ? 'success' : 'failed') as 'success' | 'failed',
                            endTime: new Date().toISOString(),
                            duration: (data.duration as number) ?? undefined,
                            error: (data.error as string) ?? undefined,
                          }
                        : e,
                    ),
                  };
                }),
              }));
            }
          }
        }),
      );
    });

    // ── board.ticket.* events → update board ────────────────
    const boardEvents = ['board.ticket.created', 'board.ticket.updated', 'board.ticket.deleted'];
    boardEvents.forEach((eventName) => {
      unsubs.push(
        client.on(eventName, (payload) => {
          pushEvent(eventName, payload);
          const data = payload as Record<string, unknown>;
          if (eventName === 'board.ticket.created') {
            useBoardStore.getState().syncCreateTicket(data.ticket as Ticket);
          } else if (eventName === 'board.ticket.updated') {
            useBoardStore.getState().syncUpdateTicket(
              data.id as string,
              data.updates as Partial<Ticket>,
            );
          } else if (eventName === 'board.ticket.deleted') {
            useBoardStore.getState().syncDeleteTicket(data.id as string);
          }
        }),
      );
    });

    // ── session.* events → refresh agents ───────────────────
    unsubs.push(
      client.on('sessions.created', (payload) => {
        pushEvent('sessions.created', payload);
        useAgentStore.getState().fetchAgents();
      }),
    );
    unsubs.push(
      client.on('sessions.closed', (payload) => {
        pushEvent('sessions.closed', payload);
        useAgentStore.getState().fetchAgents();
      }),
    );

    // ── Catch-all for any other events → event store only ──
    unsubs.push(
      client.on('*', (payload) => {
        const data = payload as { event?: string; payload?: unknown };
        // Only push events we haven't already handled specifically
        const handled = [
          'system-presence',
          'channels.status',
          'sessions.created',
          'sessions.closed',
          ...cronEvents,
          ...boardEvents,
        ];
        if (data.event && !handled.includes(data.event)) {
          pushEvent(data.event, data.payload);
        }
      }),
    );

    cleanupRef.current = unsubs;

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [client, status]);
}
