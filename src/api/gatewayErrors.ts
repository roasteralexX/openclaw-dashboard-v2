/**
 * OpenClaw Gateway Error Code System
 *
 * Maps WebSocket close codes + gateway reason strings to structured
 * OCE (OpenClaw Error) codes with human-readable explanations and
 * remediation steps (via i18n keys in the 'errors' namespace).
 */

export type ErrorCategory = 'network' | 'auth' | 'protocol' | 'server';

export interface GatewayErrorInfo {
  /** Internal OCE code, e.g. 'OCE-1001' */
  code: string;
  /** WebSocket standard close code */
  wsCode: number;
  /** High-level category for icon/color selection */
  category: ErrorCategory;
  /** i18n key suffix: errors.gateway.modal.<code>.cause */
  i18nKey: string;
  /** Raw reason string from the gateway close event */
  rawReason: string | null;
}

/* ── Pattern matching ────────────────────────────── */

interface ErrorPattern {
  code: string;
  category: ErrorCategory;
  test: (wsCode: number, reason: string) => boolean;
}

const PATTERNS: ErrorPattern[] = [
  // ── Network: abnormal closure (TLS, DNS, firewall, port closed) ──
  {
    code: 'OCE-NET',
    category: 'network',
    test: (wsCode) => wsCode === 1006,
  },

  // ── Handshake timeout ──
  {
    code: 'OCE-1006',
    category: 'network',
    test: (_, reason) =>
      /handshake.*timeout|timeout.*handshake/i.test(reason) ||
      reason.includes('Connect handshake timeout'),
  },

  // ── Client ID mismatch (schema validation at /client/id) ──
  {
    code: 'OCE-1001',
    category: 'auth',
    test: (wsCode, reason) =>
      wsCode === 1008 &&
      (/client\/id|client\.id/i.test(reason) ||
        /invalid connect params/i.test(reason)),
  },

  // ── Auth token format error (schema validation at /auth) ──
  {
    code: 'OCE-1002',
    category: 'auth',
    test: (wsCode, reason) =>
      wsCode === 1008 &&
      /auth\/token|auth\.token|invalid.*token|token.*invalid/i.test(reason) &&
      !/unauthorized/i.test(reason),
  },

  // ── Unauthorized / token rejected ──
  {
    code: 'OCE-1003',
    category: 'auth',
    test: (wsCode, reason) =>
      wsCode === 1008 &&
      /unauthorized|forbidden|access denied/i.test(reason),
  },

  // ── Protocol / version mismatch ──
  {
    code: 'OCE-1004',
    category: 'protocol',
    test: (wsCode, reason) =>
      wsCode === 1008 &&
      /protocol|version|minProtocol|maxProtocol/i.test(reason),
  },

  // ── Rate limited ──
  {
    code: 'OCE-1005',
    category: 'server',
    test: (wsCode, reason) =>
      wsCode === 1008 && /rate.?limit|too many/i.test(reason),
  },

  // ── Server-side internal error ──
  {
    code: 'OCE-SRV',
    category: 'server',
    test: (wsCode) => wsCode === 1011 || wsCode === 1013,
  },
];

/* ── Main parser ─────────────────────────────────── */

/**
 * Parse a WebSocket close event into a structured GatewayErrorInfo.
 * Patterns are tested in order; first match wins.
 * Falls back to OCE-UNKNOWN for unrecognised combinations.
 */
export function parseGatewayError(
  wsCode: number,
  rawReason: string | null,
): GatewayErrorInfo {
  const reason = rawReason?.trim() ?? '';

  for (const pattern of PATTERNS) {
    if (pattern.test(wsCode, reason)) {
      return {
        code: pattern.code,
        wsCode,
        category: pattern.category,
        i18nKey: pattern.code,
        rawReason: reason || null,
      };
    }
  }

  // ── Generic 1008 fallback (policy violation not matching above) ──
  if (wsCode === 1008) {
    return {
      code: 'OCE-1003',
      wsCode,
      category: 'auth',
      i18nKey: 'OCE-1003',
      rawReason: reason || null,
    };
  }

  return {
    code: 'OCE-UNKNOWN',
    wsCode,
    category: 'auth',
    i18nKey: 'OCE-UNKNOWN',
    rawReason: reason || null,
  };
}
