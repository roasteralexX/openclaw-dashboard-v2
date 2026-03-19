import { create } from 'zustand';

export interface GatewayEvent {
  id: string;
  event: string;
  payload: unknown;
  timestamp: number;
}

interface EventStore {
  /** Rolling buffer of recent events (max 200) */
  events: GatewayEvent[];
  /** Count of events since last user interaction */
  unreadCount: number;
  /** Whether events are actively flowing in */
  isActive: boolean;
  /** Whether the event feed drawer is open */
  feedOpen: boolean;

  /** Push a new event into the buffer */
  pushEvent: (event: string, payload: unknown) => void;
  /** Mark all events as read */
  markRead: () => void;
  /** Clear all events */
  clear: () => void;
  /** Toggle the feed drawer open/closed */
  toggleFeed: () => void;
  /** Close the feed drawer */
  closeFeed: () => void;
}

const MAX_EVENTS = 200;
let eventCounter = 0;
let isActiveTimer: ReturnType<typeof setTimeout> | null = null;

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  unreadCount: 0,
  isActive: false,
  feedOpen: false,

  pushEvent: (event, payload) => {
    const ge: GatewayEvent = {
      id: `evt-${++eventCounter}`,
      event,
      payload,
      timestamp: Date.now(),
    };

    set((s) => ({
      events: [ge, ...s.events].slice(0, MAX_EVENTS),
      unreadCount: s.unreadCount + 1,
      isActive: true,
    }));

    // Reset isActive after 2s of no events — single timer, cleared on each push
    if (isActiveTimer !== null) clearTimeout(isActiveTimer);
    isActiveTimer = setTimeout(() => {
      isActiveTimer = null;
      set(() => ({ isActive: false }));
    }, 2000);
  },

  markRead: () => set({ unreadCount: 0 }),
  clear: () => set({ events: [], unreadCount: 0, isActive: false }),
  toggleFeed: () => {
    const { feedOpen, markRead } = get();
    if (!feedOpen) markRead();
    set({ feedOpen: !feedOpen });
  },
  closeFeed: () => set({ feedOpen: false }),
}));
