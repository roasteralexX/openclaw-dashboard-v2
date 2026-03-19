import { describe, it, expect } from 'vitest';
import {
  validateChatMessage,
  validateCronId,
  sanitizeText,
  CHAT_MAX_LENGTH,
} from './validation';

// ---------------------------------------------------------------------------
// validateChatMessage
// ---------------------------------------------------------------------------

describe('validateChatMessage', () => {
  // VAL-001
  it('returns ok: false for an empty string', () => {
    const result = validateChatMessage('');
    expect(result.ok).toBe(false);
  });

  // VAL-002
  it('returns ok: false for whitespace-only input', () => {
    const result = validateChatMessage('   ');
    expect(result.ok).toBe(false);
  });

  // VAL-002 (error key check) — empty/whitespace path sets errorKey
  it('sets errorKey to "chat.sendFailed" when message is empty after trim', () => {
    expect(validateChatMessage('').errorKey).toBe('chat.sendFailed');
    expect(validateChatMessage('   ').errorKey).toBe('chat.sendFailed');
  });

  // VAL-003
  it('returns ok: true for a single non-whitespace character', () => {
    const result = validateChatMessage('a');
    expect(result.ok).toBe(true);
  });

  // VAL-004
  it('returns ok: true for a string of exactly CHAT_MAX_LENGTH chars after trim', () => {
    const msg = 'x'.repeat(CHAT_MAX_LENGTH);
    const result = validateChatMessage(msg);
    expect(result.ok).toBe(true);
  });

  // VAL-005
  it('returns ok: false for a string of CHAT_MAX_LENGTH + 1 chars', () => {
    const msg = 'x'.repeat(CHAT_MAX_LENGTH + 1);
    const result = validateChatMessage(msg);
    expect(result.ok).toBe(false);
  });

  // VAL-005 — over-length path does NOT set errorKey
  it('does not set errorKey when message exceeds max length', () => {
    const msg = 'x'.repeat(CHAT_MAX_LENGTH + 1);
    expect(validateChatMessage(msg).errorKey).toBeUndefined();
  });

  // VAL-006 — leading/trailing spaces are trimmed before length check
  it('returns ok: true when leading spaces bring trimmed length to 1', () => {
    const msg = ' '.repeat(4000) + 'a';
    const result = validateChatMessage(msg);
    expect(result.ok).toBe(true);
  });

  // VAL-006 extended — confirm trimming does not count whitespace toward length limit
  it('returns ok: true when surrounding whitespace is stripped and content fits', () => {
    const content = 'x'.repeat(CHAT_MAX_LENGTH);
    const msg = '  ' + content + '  ';
    const result = validateChatMessage(msg);
    expect(result.ok).toBe(true);
  });

  // VAL-007 — validation does not sanitize; HTML passes through
  it('returns ok: true for a message containing an HTML script tag', () => {
    const result = validateChatMessage('<script>alert(1)</script>');
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateCronId
// ---------------------------------------------------------------------------

describe('validateCronId', () => {
  // VAL-008
  it('returns ok: false for an empty string', () => {
    const result = validateCronId('');
    expect(result.ok).toBe(false);
  });

  // VAL-009
  it('returns ok: true for a hyphenated identifier', () => {
    const result = validateCronId('my-cron');
    expect(result.ok).toBe(true);
  });

  // VAL-010
  it('returns ok: true for mixed-case alphanumeric with underscores and hyphens', () => {
    const result = validateCronId('Cron_Job-01');
    expect(result.ok).toBe(true);
  });

  // VAL-011
  it('returns ok: false when the ID contains a space', () => {
    const result = validateCronId('my cron');
    expect(result.ok).toBe(false);
  });

  // VAL-012
  it('returns ok: false for an SQL-injection-style ID', () => {
    const result = validateCronId("id'; DROP TABLE");
    expect(result.ok).toBe(false);
  });

  // VAL-013
  it('returns ok: false for a path-traversal-style ID', () => {
    const result = validateCronId('../../etc/passwd');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeText
// ---------------------------------------------------------------------------

describe('sanitizeText', () => {
  // VAL-014
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  // VAL-015
  it('clamps a 5000-character string to exactly CHAT_MAX_LENGTH characters', () => {
    const input = 'a'.repeat(5000);
    const result = sanitizeText(input);
    expect(result.length).toBe(CHAT_MAX_LENGTH);
  });

  // VAL-015 — clamp happens after trim
  it('trims then clamps: surrounding whitespace is not counted in the clamped output', () => {
    const content = 'b'.repeat(CHAT_MAX_LENGTH);
    const input = '  ' + content + '  ';
    const result = sanitizeText(input);
    // After trim the string is exactly CHAT_MAX_LENGTH, so slice is a no-op
    expect(result).toBe(content);
  });

  // VAL-016
  it('returns an empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  // VAL-017 — sanitizeText does not strip HTML tags
  it('preserves HTML tags without stripping them', () => {
    expect(sanitizeText('<b>test</b>')).toBe('<b>test</b>');
  });
});
