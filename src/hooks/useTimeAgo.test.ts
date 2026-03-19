import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimeAgo } from './useTimeAgo';

// The mock tc returns the key alone when no opts are given, or
// "key:{"count":N}" when opts are given — matching exactly what
// the source code checks: `secsKey !== 'time.secsAgo'` (line 16).
vi.mock('./useI18n', () => ({
  useI18n: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    tc: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

// A fixed "now" so every diff is deterministic.
// 2026-03-18T12:00:00.000Z  →  epoch ms
const NOW = new Date('2026-03-18T12:00:00.000Z').getTime();

function msAgo(ms: number): number {
  return NOW - ms;
}

describe('useTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function getTimeAgo() {
    const { result } = renderHook(() => useTimeAgo());
    return result.current;
  }

  // ── undefined input ────────────────────────────────────────────────────────

  it('returns justNow for undefined input', () => {
    const timeAgo = getTimeAgo();
    expect(timeAgo(undefined)).toBe('time.justNow');
  });

  // ── sub-minute inputs without seconds flag ─────────────────────────────────

  it('returns justNow for a timestamp 30s ago (no seconds flag)', () => {
    const timeAgo = getTimeAgo();
    const thirtySecsAgo = msAgo(30 * 1000);
    expect(timeAgo(thirtySecsAgo)).toBe('time.justNow');
  });

  it('returns justNow for a timestamp 59s ago (no seconds flag)', () => {
    const timeAgo = getTimeAgo();
    const fiftyNineSecsAgo = msAgo(59 * 1000);
    expect(timeAgo(fiftyNineSecsAgo)).toBe('time.justNow');
  });

  // ── seconds flag: secsAgo key returned because mock returns non-identity ───

  it('returns secsAgo key with count when seconds=true and diff < 60s', () => {
    const timeAgo = getTimeAgo();
    // With the mock, tc('time.secsAgo', { count: 30 }) returns
    // 'time.secsAgo:{"count":30}', which !== 'time.secsAgo', so the
    // hook returns that string directly (not the justNow fallback).
    const thirtySecsAgo = msAgo(30 * 1000);
    expect(timeAgo(thirtySecsAgo, true)).toBe('time.secsAgo:{"count":30}');
  });

  it('returns secsAgo key with count 1 when seconds=true and diff is 1s', () => {
    const timeAgo = getTimeAgo();
    const oneSecAgo = msAgo(1 * 1000);
    expect(timeAgo(oneSecAgo, true)).toBe('time.secsAgo:{"count":1}');
  });

  // ── minutes ────────────────────────────────────────────────────────────────

  it('returns minsAgo with count 1 for exactly 60s ago', () => {
    const timeAgo = getTimeAgo();
    const oneMinAgo = msAgo(60 * 1000);
    expect(timeAgo(oneMinAgo)).toBe('time.minsAgo:{"count":1}');
  });

  it('returns minsAgo with count 45 for 45 minutes ago', () => {
    const timeAgo = getTimeAgo();
    const fortyFiveMinAgo = msAgo(45 * 60 * 1000);
    expect(timeAgo(fortyFiveMinAgo)).toBe('time.minsAgo:{"count":45}');
  });

  it('returns minsAgo with count 59 for 59 minutes ago', () => {
    const timeAgo = getTimeAgo();
    const fiftyNineMinAgo = msAgo(59 * 60 * 1000);
    expect(timeAgo(fiftyNineMinAgo)).toBe('time.minsAgo:{"count":59}');
  });

  // ── hours ──────────────────────────────────────────────────────────────────

  it('returns hoursAgo with count 1 for exactly 1 hour ago', () => {
    const timeAgo = getTimeAgo();
    const oneHourAgo = msAgo(60 * 60 * 1000);
    expect(timeAgo(oneHourAgo)).toBe('time.hoursAgo:{"count":1}');
  });

  it('returns hoursAgo with count 23 for 23 hours ago', () => {
    const timeAgo = getTimeAgo();
    const twentyThreeHoursAgo = msAgo(23 * 60 * 60 * 1000);
    expect(timeAgo(twentyThreeHoursAgo)).toBe('time.hoursAgo:{"count":23}');
  });

  // ── days ───────────────────────────────────────────────────────────────────

  it('returns daysAgo with count 1 for exactly 24 hours ago', () => {
    const timeAgo = getTimeAgo();
    const oneDayAgo = msAgo(24 * 60 * 60 * 1000);
    expect(timeAgo(oneDayAgo)).toBe('time.daysAgo:{"count":1}');
  });

  it('returns daysAgo with count 7 for 7 days ago', () => {
    const timeAgo = getTimeAgo();
    const sevenDaysAgo = msAgo(7 * 24 * 60 * 60 * 1000);
    expect(timeAgo(sevenDaysAgo)).toBe('time.daysAgo:{"count":7}');
  });

  // ── ISO string input ───────────────────────────────────────────────────────

  it('accepts an ISO string and produces the same result as a numeric timestamp', () => {
    const timeAgo = getTimeAgo();
    const fiveMinAgoMs  = msAgo(5 * 60 * 1000);
    const fiveMinAgoIso = new Date(fiveMinAgoMs).toISOString();

    const fromNumber = timeAgo(fiveMinAgoMs);
    const fromString = timeAgo(fiveMinAgoIso);

    expect(fromNumber).toBe('time.minsAgo:{"count":5}');
    expect(fromString).toBe(fromNumber);
  });

  it('accepts an ISO string for a 2-day-old timestamp', () => {
    const timeAgo = getTimeAgo();
    const twoDaysAgoIso = new Date(msAgo(2 * 24 * 60 * 60 * 1000)).toISOString();
    expect(timeAgo(twoDaysAgoIso)).toBe('time.daysAgo:{"count":2}');
  });
});
