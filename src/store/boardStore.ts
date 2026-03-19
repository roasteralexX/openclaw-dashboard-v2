import { create } from 'zustand';
import type { Ticket, TeamMember, TicketColumn, BoardFilter } from '../types';
import { getGatewayClient } from '../api/gatewayGuard';
import { apiFetch } from '../api/apiFetch';

const DEFAULT_FILTER: BoardFilter = {
  search: '',
  priorities: [],
  labels: [],
  assigneeId: null,
};

interface BoardStore {
  tickets: Ticket[];
  team: TeamMember[];
  selectedTicketId: string | null;
  filter: BoardFilter;
  loading: boolean;

  selectTicket: (id: string | null) => void;
  moveTicket: (ticketId: string, column: TicketColumn) => void;
  addTicket: (ticket: Ticket) => void;
  updateTicket: (id: string, updates: Partial<Ticket>) => void;
  deleteTicket: (id: string) => void;
  setFilter: (filter: Partial<BoardFilter>) => void;
  clearFilter: () => void;
  filteredTickets: () => Ticket[];
  fetchTickets: () => Promise<void>;
  syncCreateTicket: (ticket: Ticket) => void;
  syncUpdateTicket: (id: string, updates: Partial<Ticket>) => void;
  syncDeleteTicket: (id: string) => void;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost(path: string, body: unknown): Promise<void> {
  await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function apiPut(path: string, body: unknown): Promise<void> {
  await apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function apiDelete(path: string): Promise<void> {
  await apiFetch(path, { method: 'DELETE' });
}

function boardSync(rpcMethod: string, rpcPayload: Record<string, unknown>): void {
  const gw = getGatewayClient();
  if (!gw) return;
  gw.client.call(rpcMethod, rpcPayload).catch((err: unknown) => {
    console.warn(`[boardStore] ${rpcMethod} sync failed:`, err);
  });
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  tickets: [],
  team: [],
  selectedTicketId: null,
  filter: DEFAULT_FILTER,
  loading: false,

  selectTicket: (id) => set({ selectedTicketId: id }),

  moveTicket: (ticketId, column) => {
    const updatedAt = new Date().toISOString();
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === ticketId ? { ...t, column, updatedAt } : t
      ),
    }));
    // SQLite — primary persistence
    apiPut(`/api/board/tickets/${ticketId}`, { column, updatedAt })
      .catch((err: unknown) => console.warn('[BoardStore] moveTicket API failed:', err));
    // Gateway — best-effort secondary sync
    boardSync('board.ticket.update', { id: ticketId, updates: { column } });
  },

  addTicket: (ticket) => {
    set((s) => ({ tickets: [...s.tickets, ticket] }));
    apiPost('/api/board/tickets', ticket)
      .catch((err: unknown) => console.warn('[BoardStore] addTicket API failed:', err));
    boardSync('board.ticket.create', { ticket });
  },

  updateTicket: (id, updates) => {
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    }));
    apiPut(`/api/board/tickets/${id}`, updates)
      .catch((err: unknown) => console.warn('[BoardStore] updateTicket API failed:', err));
    boardSync('board.ticket.update', { id, updates });
  },

  deleteTicket: (id) => {
    set((s) => ({
      tickets: s.tickets.filter((t) => t.id !== id),
      selectedTicketId: s.selectedTicketId === id ? null : s.selectedTicketId,
    }));
    apiDelete(`/api/board/tickets/${id}`)
      .catch((err: unknown) => console.warn('[BoardStore] deleteTicket API failed:', err));
    boardSync('board.ticket.delete', { id });
  },

  setFilter: (filter) =>
    set((s) => ({ filter: { ...s.filter, ...filter } })),

  clearFilter: () => set({ filter: DEFAULT_FILTER }),

  filteredTickets: () => {
    const { tickets, filter } = get();
    return tickets.filter((t) => {
      if (filter.search && !t.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
      if (filter.priorities.length && !filter.priorities.includes(t.priority)) return false;
      if (filter.labels.length && !filter.labels.some((l) => t.labels.includes(l))) return false;
      if (filter.assigneeId && t.assigneeId !== filter.assigneeId) return false;
      return true;
    });
  },

  fetchTickets: async () => {
    set({ loading: true });
    try {
      // SQLite API — primary source of truth
      const tickets = await apiGet<Ticket[]>('/api/board/tickets');
      if (tickets.length > 0) {
        set({ tickets, loading: false });
        return;
      }
    } catch {
      // API unavailable — fall through to gateway
    }
    // Gateway fallback
    const gw = getGatewayClient();
    if (gw) {
      try {
        const res = await gw.client.call<Record<string, unknown>>('board.tickets.list');
        const fetched = ((res as Record<string, unknown>)?.tickets ?? []) as Ticket[];
        if (fetched.length) {
          set({ tickets: fetched, loading: false });
          return;
        }
      } catch {
        // Gateway also failed
      }
    }
    set({ tickets: [], loading: false });
  },

  syncCreateTicket: (ticket) =>
    set((s) => ({ tickets: [...s.tickets, ticket] })),

  syncUpdateTicket: (id, updates) =>
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    })),

  syncDeleteTicket: (id) =>
    set((s) => ({
      tickets: s.tickets.filter((t) => t.id !== id),
      selectedTicketId: s.selectedTicketId === id ? null : s.selectedTicketId,
    })),
}));
