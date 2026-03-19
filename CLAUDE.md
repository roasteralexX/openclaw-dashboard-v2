# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start Vite dev server with HMR
npm run build         # TypeScript check (tsc -b) + Vite bundle to dist/
npm run lint          # ESLint (flat config, React rules)
npm run preview       # Preview production build locally
npm run i18n:validate # Check key parity across all 3 locales
```

## Architecture

**OpenClaw Command Center** — A real-time AI agent orchestration dashboard for any domain. Connects to an OpenClaw Gateway via WebSocket RPC. All modules have `/chat`, `/agents`, `/crons`, `/board`, `/office`, `/health`, `/settings` routes.

### Data Flow

All data flows through a single custom WebSocket RPC client (`src/api/openclawClient.ts`). Gateway protocol lifecycle: connect → receive challenge → send auth → `hello-ok`. After auth:
- `client.call(method, params)` — RPC call with 15s timeout
- `client.on(eventName, callback)` — event subscription, returns unsubscribe fn
- Auto-reconnect with exponential backoff (max 30s)
- Circuit breaker: after repeated failures → `'suspended'` state → manual resume required

When disconnected, all stores fall back to mock data from `src/api/mock.ts`. The app never breaks without a connection.

### State Management (Zustand)

Stores under `src/store/`:
- `connectionStore` — WS URL + auth token (persisted in localStorage), connection lifecycle, `transportMode()` (secure/local/insecure), `resetCircuit()`
- `agentStore` — `sessions.list` + `channels.status` RPC, `Agent[]`, `selectedAgentId`
- `cronStore` — cron jobs + execution history; `toggleCron` and `runCron` validate IDs + audit log
- `boardStore` — Kanban tickets + drag state
- `officeStore` — 3D desk positions
- `eventStore` — real-time event feed, `unreadCount`, `toggleFeed`
- `healthStore` — gateway node/model diagnostics
- `auditStore` — security audit trail to sessionStorage (see Security section)
- `toastStore` — toast notification queue
- `i18nStore` — active language preference

### Module Structure

Feature pages under `src/modules/`, each with a `.module.css`. All pages are `React.lazy` + `Suspense` loaded.

- `overview/` — KPI dashboard, gateway health strip, token usage chart
- `agents/` — Agent list + detail panel with inline chat (`chat.send` RPC)
- `chat/` — Dedicated full-screen chat module (streaming, abort, markdown rendering)
- `crons/` — Scheduled job management
- `board/` — Drag-and-drop Kanban (5 columns, @dnd-kit)
- `office/` — 3D visualization (Three.js / React Three Fiber / Drei)
- `health/` — Gateway node and model health diagnostics
- `settings/` — Gateway connection config + security controls + audit log viewer

Shell: `src/components/shell/` — `AppShell` (root layout) → `Sidebar` + `Topbar` + `Footer` + `EventFeed` + `<Outlet>`.

Real-time event listening at the root level via `src/hooks/useGatewayEvents.ts`.

### Chat Module (src/modules/chat/ChatPage.tsx)

The most complex module. Key patterns to understand:

**Streaming state** — two-layer to avoid re-render thrashing:
```typescript
const streamRef = useRef<StreamRef>({ active, sessionKey, runId, buffer });
// Raw deltas accumulate in streamRef.current.buffer (no React overhead)
// requestAnimationFrame flushes to useState at ~60fps max
```

**Stale closure prevention** — `selectedKeyRef.current` updated in a `useEffect`; event handlers read from the ref instead of capturing agent ID in their closure.

**Event subscription pattern** (mirrors `useGatewayEvents.ts`):
```typescript
useEffect(() => {
  if (status !== 'connected' || !client) return;
  const unsubs = [
    client.on('chat.started', handleStarted),
    client.on('chat.delta', handleDelta),
    client.on('chat.final', handleFinal),
  ];
  return () => { unsubs.forEach(fn => fn()); };
}, [client, status, handleStarted, handleDelta, handleFinal]);
```

**30-second fallback** — if `chat.final` never fires (non-streaming gateway), a `setTimeout` uses the accumulated buffer or call return value.

**Key RPC methods for chat:** `chat.send`, `chat.abort`
**Streaming events:** `chat.started` → `chat.delta` (N times) → `chat.final`
**Session key format:** `agent:<agentId>:main`

### Security Layer

Seven layers implemented across the codebase:

1. **Transport validation** (`connectionStore.transportMode()`) — returns `'secure'` | `'local'` | `'insecure'`. SettingsPage blocks connect when insecure unless break-glass checkbox is checked.
2. **Input validation** (`src/api/validation.ts`) — `validateChatMessage` (max 4000 chars), `validateCronId` (alphanumeric + `-_` only), `TOKEN_MIN_LENGTH = 32`. Always validate before RPC calls.
3. **Input sanitization** (`sanitizeText` in `validation.ts`) — trim + clamp. Apply after validation, before RPC.
4. **Rate limiting** (`src/api/rateLimiter.ts`) — `TokenBucketRateLimiter` class; `chatRateLimiter` singleton (burst 5, refill 0.5/s). Call `chatRateLimiter.tryConsume()` before `chat.send`. Visual 5-dot indicator in ChatPage driven by `setInterval`.
5. **Audit trail** (`src/store/auditStore.ts`) — `useAuditStore().log(action, detail, { wsUrl? })`. Actions: `connect`, `disconnect`, `chat.send`, `cron.toggle`, `cron.run`, `settings.save`. Persists to `sessionStorage` (max 500 entries). **Never log auth token values.**
6. **Circuit breaker** — `'suspended'` ConnectionState; `resetCircuit()` for manual recovery. Sidebar shows resume button + amber dot when suspended.
7. **CSP + security headers** — defined in `vite.config.ts` (`securityHeaders` const), applied to both `server.headers` and `preview.headers`. Also as `<meta>` tags in `index.html`. `unsafe-inline` in `script-src` is required for FOUC-prevention inline script.

When adding new RPC call sites: validate input → sanitize → rate-limit (if user-triggered) → call → audit log.

### i18n System

Three locales: `en-US`, `pt-BR`, `es`. Ten namespaces: `common`, `dashboard`, `agents`, `chat`, `crons`, `kanban`, `office3d`, `health`, `settings`, `charts`, `errors`.

Three files must stay in sync when adding a namespace:
1. `src/i18n/config.ts` — `NAMESPACES` array + `Namespace` type
2. `src/i18n/types.ts` — `import type` + `resources` entry for TypeScript autocomplete
3. `scripts/validate-i18n.mjs` — `NAMESPACES` array

Usage in components:
```typescript
const { t } = useI18n('chat');         // namespace-scoped
const { t: tc } = useI18n();           // common namespace
```

**Important:** i18next's typed `TFunction` cannot be passed as a generic `(key: string, opts?) => string` prop to sub-components. Sub-components must call `useI18n()` directly — never pass `t` as a prop.

### Design System

**Industrial Command Center** aesthetic. Tokens in `src/styles/index.css`:
- Base: `#0D0F14` (dark charcoal), Surface: `#151820`
- Accent: `#00E5FF` (electric cyan) — primary actions
- Warning: `#FFB300` (amber) — warnings, insecure transport
- Success: `#00E676`, Error: `#FF1744`
- Display: Space Grotesk, Mono: IBM Plex Mono

All component styles use **CSS Modules** (`.module.css`). Animations in `src/styles/animations.css`. Maintain this aesthetic — no generic/template layouts.

### TypeScript Config

Strict mode with `noUnusedLocals` and `noUnusedParameters` enforced — unused variables cause build failures. When unused params are needed (e.g. interface stubs), prefix with `_`.

### Build Chunking

Manual chunks in `vite.config.ts`: `vendor-react`, `vendor-three` (lazy, /office only), `vendor-recharts`, `vendor-dndkit` (lazy, /board only), `vendor-i18n`, `vendor-misc`.
