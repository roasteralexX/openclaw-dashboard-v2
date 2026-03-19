import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenBucketRateLimiter, chatRateLimiter } from './rateLimiter';

// ---------------------------------------------------------------------------
// TokenBucketRateLimiter
// ---------------------------------------------------------------------------

describe('TokenBucketRateLimiter', () => {
  // The constructor accepts a RateLimiterConfig object: { capacity, refillRatePerSec }
  // capacity=5, refillRatePerSec=0.5 → 1 new token every 2 seconds

  let limiter: TokenBucketRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new TokenBucketRateLimiter({ capacity: 5, refillRatePerSec: 0.5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // RL-001 — bucket starts full
  it('starts with tokens equal to capacity', () => {
    expect(limiter.available).toBe(5);
  });

  // RL-002
  it('tryConsume() returns true when tokens are available', () => {
    expect(limiter.tryConsume()).toBe(true);
  });

  // RL-003
  it('tryConsume() decrements the available token count by 1', () => {
    limiter.tryConsume();
    expect(limiter.available).toBe(4);
  });

  // RL-004
  it('five consecutive tryConsume() calls all return true on a full bucket', () => {
    const results = Array.from({ length: 5 }, () => limiter.tryConsume());
    expect(results).toEqual([true, true, true, true, true]);
  });

  // RL-005
  it('the sixth tryConsume() returns false when the bucket is empty', () => {
    for (let i = 0; i < 5; i++) limiter.tryConsume();
    expect(limiter.tryConsume()).toBe(false);
  });

  // RL-006 — cost parameter: tryConsume(3) consumes 3 tokens at once
  it('tryConsume(3) consumes 3 tokens in one call', () => {
    limiter.tryConsume(3);
    expect(limiter.available).toBe(2);
  });

  it('tryConsume(3) returns false when fewer than 3 tokens remain', () => {
    limiter.tryConsume(3); // 5 → 2
    expect(limiter.tryConsume(3)).toBe(false); // 2 < 3
  });

  // RL-007 — refill after elapsed time
  it('refills 1 token after 2 seconds have elapsed (rate 0.5/s)', () => {
    // Drain the bucket completely
    for (let i = 0; i < 5; i++) limiter.tryConsume();
    expect(limiter.available).toBe(0);

    // Advance time by 2 seconds → 2s * 0.5 tokens/s = 1 token refilled
    vi.advanceTimersByTime(2000);

    expect(limiter.available).toBe(1);
  });

  it('refills the correct fractional amount for any elapsed duration', () => {
    // Drain all tokens
    for (let i = 0; i < 5; i++) limiter.tryConsume();

    // Advance 4 seconds → 4 * 0.5 = 2.0 tokens; available floors to 2
    vi.advanceTimersByTime(4000);

    expect(limiter.available).toBe(2);
  });

  // RL-008 — refill never exceeds capacity
  it('refill never exceeds the configured capacity', () => {
    // Advance far into the future (1 hour)
    vi.advanceTimersByTime(3_600_000);

    expect(limiter.available).toBe(5); // capped at capacity
  });

  it('returns false when trying to consume more tokens than capacity from a full bucket', () => {
    expect(limiter.tryConsume(6)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chatRateLimiter singleton
// ---------------------------------------------------------------------------

describe('chatRateLimiter', () => {
  // RL-009
  it('is exported as a TokenBucketRateLimiter instance', () => {
    expect(chatRateLimiter).toBeInstanceOf(TokenBucketRateLimiter);
  });

  it('has an available getter that returns a non-negative integer', () => {
    const tokens = chatRateLimiter.available;
    expect(typeof tokens).toBe('number');
    expect(tokens).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(tokens)).toBe(true);
  });

  it('exposes a tryConsume method', () => {
    expect(typeof chatRateLimiter.tryConsume).toBe('function');
  });
});
