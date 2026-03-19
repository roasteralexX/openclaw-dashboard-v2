/**
 * Token Bucket Rate Limiter
 * Client-side throttle to prevent flooding RPC endpoints.
 */

export interface RateLimiterConfig {
  capacity: number;        // max tokens in bucket (burst size)
  refillRatePerSec: number; // tokens added per second
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRatePerSec: number;

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity;
    this.refillRatePerSec = config.refillRatePerSec;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  /** Attempt to consume `cost` tokens. Returns true if allowed, false if throttled. */
  tryConsume(cost = 1): boolean {
    this.refill();
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  /** Remaining tokens (after applying elapsed refill). */
  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerSec);
    this.lastRefill = now;
  }
}

/**
 * Shared rate limiter for chat.send RPC calls.
 * Allows bursts of 5 messages; refills at 1 message every 2 seconds.
 */
export const chatRateLimiter = new TokenBucketRateLimiter({
  capacity: 5,
  refillRatePerSec: 0.5,
});
