import { create } from 'zustand';
import type { OfficeDesk, DeskPosition } from '../types';
import { apiFetch } from '../api/apiFetch';

interface OfficeStore {
  desks: OfficeDesk[];
  editMode: boolean;
  selectedDeskId: string | null;
  loading: boolean;
  fetchDesks: () => Promise<void>;
  toggleEditMode: () => void;
  selectDesk: (id: string | null) => void;
  moveDesk: (id: string, position: DeskPosition) => void;
  rotateDesk: (id: string) => void;
  resetLayout: () => Promise<void>;
}

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  desks: [],
  editMode: false,
  selectedDeskId: null,
  loading: false,

  fetchDesks: async () => {
    set({ loading: true });
    try {
      const res = await apiFetch('/api/office/desks');
      if (res.ok) {
        const desks = (await res.json()) as OfficeDesk[];
        set({ desks, loading: false });
        return;
      }
    } catch {
      // API unavailable
    }
    set({ loading: false });
  },

  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  selectDesk: (id) => set({ selectedDeskId: id }),

  moveDesk: (id, position) => {
    set((s) => ({
      desks: s.desks.map((d) => (d.id === id ? { ...d, position } : d)),
    }));
    apiFetch(`/api/office/desks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position }),
    }).catch((err: unknown) => console.warn('[OfficeStore] moveDesk API failed:', err));
  },

  rotateDesk: (id) => {
    const newRotation = (() => {
      const desk = get().desks.find((d) => d.id === id);
      return desk ? (desk.rotation + Math.PI / 2) % (Math.PI * 2) : 0;
    })();
    set((s) => ({
      desks: s.desks.map((d) =>
        d.id === id ? { ...d, rotation: newRotation } : d
      ),
    }));
    apiFetch(`/api/office/desks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotation: newRotation }),
    }).catch((err: unknown) => console.warn('[OfficeStore] rotateDesk API failed:', err));
  },

  resetLayout: async () => {
    try {
      const res = await apiFetch('/api/office/desks/reset', { method: 'POST' });
      if (res.ok) {
        const desks = (await res.json()) as OfficeDesk[];
        set({ desks });
      }
    } catch (err) {
      console.warn('[OfficeStore] resetLayout API failed:', err);
    }
  },
}));
