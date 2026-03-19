/**
 * Input validation utilities for RPC calls.
 * Validates user input before it reaches the gateway.
 */

export const CHAT_MAX_LENGTH = 4000;
export const CRON_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const TOKEN_MIN_LENGTH = 32;

export interface ValidationResult {
  ok: boolean;
  errorKey?: string;
}

/** Validate a chat message before sending via chat.send RPC */
export function validateChatMessage(msg: string): ValidationResult {
  const trimmed = msg.trim();
  if (!trimmed) return { ok: false, errorKey: 'chat.sendFailed' };
  if (trimmed.length > CHAT_MAX_LENGTH) return { ok: false };
  return { ok: true };
}

/** Validate a cron ID before passing to cron.enable / cron.disable / cron.run */
export function validateCronId(id: string): ValidationResult {
  if (!id) return { ok: false };
  if (!CRON_ID_PATTERN.test(id)) return { ok: false };
  return { ok: true };
}

/** Trim and clamp a string to CHAT_MAX_LENGTH */
export function sanitizeText(input: string): string {
  return input.trim().slice(0, CHAT_MAX_LENGTH);
}
