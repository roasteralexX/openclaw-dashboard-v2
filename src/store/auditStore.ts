/**
 * Security Audit Store
 * Persistent audit trail for sensitive RPC operations.
 * Stored in SQLite via /api/audit — survives browser close.
 * Never logs auth token values.
 */

import { create } from 'zustand';
import { apiFetch } from '../api/apiFetch';

export type AuditAction =
  | 'connect'
  | 'disconnect'
  | 'chat.send'
  | 'cron.toggle'
  | 'cron.run'
  | 'settings.save';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  detail: string;
  wsUrl?: string;
}

const MAX_ENTRIES = 500;

async function apiPost(entry: AuditEntry): Promise<void> {
  try {
    await apiFetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    // API unavailable — degrade silently
  }
}

interface AuditStore {
  entries: AuditEntry[];
  initialized: boolean;
  init: () => Promise<void>;
  log: (action: AuditAction, detail: string, extra?: Pick<AuditEntry, 'wsUrl'>) => void;
  clear: () => void;
}

export const useAuditStore = create<AuditStore>((set, get) => ({
  entries: [],
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    try {
      const res = await apiFetch('/api/audit');
      if (res.ok) {
        const entries = (await res.json()) as AuditEntry[];
        set({ entries: entries.slice(-MAX_ENTRIES), initialized: true });
      }
    } catch {
      set({ initialized: true });
    }
  },

  log: (action, detail, extra) => {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      detail,
      ...extra,
    };
    const next = [...get().entries, entry].slice(-MAX_ENTRIES);
    set({ entries: next });
    void apiPost(entry);
  },

  clear: () => {
    set({ entries: [] });
    apiFetch('/api/audit', { method: 'DELETE' }).catch(() => {});
  },
}));
