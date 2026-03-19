import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEventStore } from './eventStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shortcut to access the current store snapshot without React. */
const getState = () => useEventStore.getState();

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();

  // Reset all observable store fields to a clean baseline.
  // Note: the module-level `eventCounter` and `isActiveTimer` are NOT reset
  // here — they are implementation internals. Tests must therefore match IDs
  // with a regex rather than expecting exact sequential numbers.
  useEventStore.setState({
    events: [],
    unreadCount: 0,
    isActive: false,
    feedOpen: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// pushEvent
// ---------------------------------------------------------------------------

describe('pushEvent', () => {
  it('ES-001: adds the new event to the head of the events array', () => {
    getState().pushEvent('test', {});

    const { events } = getState();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('test');
    expect(events[0].payload).toEqual({});
  });

  it('ES-002: increments unreadCount by 1 per push', () => {
    getState().pushEvent('a', {});
    getState().pushEvent('b', {});

    expect(getState().unreadCount).toBe(2);
  });

  it('ES-003: sets isActive to true', () => {
    expect(getState().isActive).toBe(false);

    getState().pushEvent('active-check', {});

    expect(getState().isActive).toBe(true);
  });

  it('ES-004: caps the events buffer at 200 entries (MAX_EVENTS)', () => {
    // Push 201 events; the oldest should be dropped.
    for (let i = 0; i < 201; i++) {
      getState().pushEvent('flood', { i });
    }

    expect(getState().events).toHaveLength(200);
  });

  it('ES-005: isActive resets to false after 2000 ms with no new events', () => {
    getState().pushEvent('timer-test', {});
    expect(getState().isActive).toBe(true);

    vi.advanceTimersByTime(2001);

    expect(getState().isActive).toBe(false);
  });

  it('ES-006: rapid consecutive pushes result in only one pending 2 s timer', () => {
    // Push 3 events in quick succession — each push resets the debounce timer.
    getState().pushEvent('rapid-1', {});
    getState().pushEvent('rapid-2', {});
    getState().pushEvent('rapid-3', {});

    // One millisecond before the final timer would fire — still active.
    vi.advanceTimersByTime(1999);
    expect(getState().isActive).toBe(true);

    // Cross the 2 s boundary — timer fires, isActive becomes false.
    vi.advanceTimersByTime(1);
    expect(getState().isActive).toBe(false);
  });

  it('ES-012: each event gets a unique ID matching the evt-N pattern', () => {
    getState().pushEvent('id-check-1', {});
    getState().pushEvent('id-check-2', {});

    const { events } = getState();
    expect(events).toHaveLength(2);

    // Both IDs must match the expected pattern.
    events.forEach((evt) => {
      expect(evt.id).toMatch(/^evt-\d+$/);
    });

    // The two IDs must be distinct (prepended to array, so [1] is older).
    expect(events[0].id).not.toBe(events[1].id);
  });
});

// ---------------------------------------------------------------------------
// markRead
// ---------------------------------------------------------------------------

describe('markRead', () => {
  it('ES-007: sets unreadCount to 0 while leaving events array unchanged', () => {
    getState().pushEvent('ev-1', { x: 1 });
    getState().pushEvent('ev-2', { x: 2 });
    expect(getState().unreadCount).toBe(2);

    getState().markRead();

    expect(getState().unreadCount).toBe(0);
    // Events themselves are untouched.
    expect(getState().events).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe('clear', () => {
  it('ES-008: resets events to [], unreadCount to 0, and isActive to false', () => {
    getState().pushEvent('pre-clear', {});
    expect(getState().events).toHaveLength(1);
    expect(getState().unreadCount).toBe(1);
    expect(getState().isActive).toBe(true);

    getState().clear();

    expect(getState().events).toEqual([]);
    expect(getState().unreadCount).toBe(0);
    expect(getState().isActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleFeed
// ---------------------------------------------------------------------------

describe('toggleFeed', () => {
  it('ES-009: when feed is closed, toggleFeed opens it and resets unreadCount to 0', () => {
    // Accumulate some unread events first.
    getState().pushEvent('unread-1', {});
    getState().pushEvent('unread-2', {});
    expect(getState().unreadCount).toBe(2);
    expect(getState().feedOpen).toBe(false);

    getState().toggleFeed();

    expect(getState().feedOpen).toBe(true);
    expect(getState().unreadCount).toBe(0);
  });

  it('ES-010: when feed is open, toggleFeed closes it and does NOT reset unreadCount', () => {
    // Open the feed first (this will call markRead, zeroing the counter).
    useEventStore.setState({ feedOpen: true });

    // Simulate new events arriving while the feed is already open.
    getState().pushEvent('while-open', {});
    expect(getState().unreadCount).toBe(1);

    getState().toggleFeed();

    expect(getState().feedOpen).toBe(false);
    // unreadCount must NOT be reset when closing.
    expect(getState().unreadCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// closeFeed
// ---------------------------------------------------------------------------

describe('closeFeed', () => {
  it('ES-011: sets feedOpen to false', () => {
    useEventStore.setState({ feedOpen: true });

    getState().closeFeed();

    expect(getState().feedOpen).toBe(false);
  });
});
