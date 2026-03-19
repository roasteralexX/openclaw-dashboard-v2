# OpenClaw Command Center v2

A real-time AI agent orchestration dashboard that connects to any **OpenClaw Gateway** via WebSocket RPC and provides a professional command interface for monitoring agents, scheduling cron jobs, managing projects, and chatting directly with AI agent sessions.

---

## Features

| Module | Description |
|---|---|
| **Overview** | KPI dashboard, gateway health strip, token usage charts |
| **Agents** | Live agent session list with inline chat (`chat.send` RPC) |
| **Chat** | Dedicated full-screen chat with streaming responses, abort support, and markdown rendering |
| **Cron Jobs** | Schedule management with execution history |
| **Project Board** | Drag-and-drop Kanban (5 columns, @dnd-kit) |
| **3D Office** | Spatial visualization of active agent desks (Three.js / React Three Fiber) |
| **GW Health** | Gateway node and model diagnostics |
| **Settings** | Gateway connection config with security controls and audit log |

**Works offline** — all modules fall back to synthetic mock data when the gateway is disconnected. The UI never breaks.

---

## Tech Stack

- **React 19** + **TypeScript 5.9** (strict mode)
- **Vite 8** — build tooling with manual chunk splitting
- **Zustand 5** — domain stores with localStorage persistence
- **React Router 7** — file-based routing with lazy-loaded pages
- **i18next** — full i18n in **EN-US**, **PT-BR**, and **ES**
- **Recharts** — token usage and health charts
- **@dnd-kit** — accessible drag-and-drop for Kanban
- **Three.js / React Three Fiber / Drei** — 3D office view
- **Framer Motion** — UI micro-animations
- **Lucide React** — icon system

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev
```

To connect to a live gateway, open **Settings**, enter your gateway WebSocket URL (e.g. `wss://your-gateway.example.com`) and auth token, then click **Connect**.

---

## Scripts

```bash
npm run dev           # Vite dev server with HMR
npm run build         # TypeScript check + production bundle → dist/
npm run preview       # Preview production build locally
npm run lint          # ESLint (flat config)
npm run i18n:validate # Verify all locale files have parity across EN/PT-BR/ES
```

---

## Project Structure

```
src/
├── api/
│   ├── openclawClient.ts   # WebSocket RPC client (connect, call, on, reconnect)
│   ├── mock.ts             # Synthetic fallback data
│   ├── validation.ts       # Input validation (chat messages, cron IDs)
│   └── rateLimiter.ts      # Token bucket rate limiter (chat.send)
├── store/
│   ├── connectionStore.ts  # WS lifecycle, circuit breaker, transport security
│   ├── agentStore.ts       # Agent sessions + selected agent state
│   ├── cronStore.ts        # Cron jobs + execution history
│   ├── boardStore.ts       # Kanban tickets + drag state
│   ├── officeStore.ts      # 3D desk positions
│   ├── eventStore.ts       # Real-time event feed
│   ├── healthStore.ts      # Gateway node/model health data
│   ├── auditStore.ts       # Security audit trail (sessionStorage)
│   ├── toastStore.ts       # Toast notification queue
│   └── i18nStore.ts        # Active language preference
├── modules/
│   ├── overview/           # KPI dashboard
│   ├── agents/             # Agent list + inline chat
│   ├── chat/               # Dedicated streaming chat module
│   ├── crons/              # Cron job management
│   ├── board/              # Kanban board
│   ├── office/             # 3D office visualization
│   ├── health/             # Gateway health diagnostics
│   └── settings/           # Connection config + security
├── components/
│   ├── shell/              # AppShell, Sidebar, Topbar, Footer, EventFeed
│   ├── board/              # TicketPanel, TicketModal
│   ├── shared/             # GatewayEmptyState, Toast, illustrations
│   └── ui/                 # Shared UI primitives
├── hooks/
│   ├── useGatewayEvents.ts # Root-level real-time event listener
│   ├── useI18n.ts          # Typed i18n hook wrapper
│   └── useToast.ts         # Toast helper
├── locales/
│   ├── en-US/              # English (10 namespaces)
│   ├── pt-BR/              # Brazilian Portuguese
│   └── es/                 # Spanish
├── styles/
│   ├── index.css           # Design tokens (CSS variables)
│   └── animations.css      # Keyframe animation library
└── types/
    └── index.ts            # App types + Gateway protocol types
```

---

## Gateway Protocol

The app communicates with the OpenClaw Gateway over a persistent WebSocket connection.

**Authentication handshake:**
```
client connects → server sends challenge → client sends { token } → server responds hello-ok
```

**RPC pattern:**
```typescript
// Fire-and-forget call with 15s timeout
await client.call('chat.send', { sessionKey: 'agent:abc:main', message: 'Hello' });

// Event subscription
client.on('chat.delta', (payload) => { /* streaming chunk */ });
client.on('chat.final', (payload) => { /* complete response */ });
```

**Key RPC methods:** `sessions.list`, `channels.status`, `health`, `models.list`, `node.list`, `sessions.history`, `chat.send`, `chat.abort`

**Streaming chat events:** `chat.started` → `chat.delta` (repeating) → `chat.final`

**Session key format:** `agent:<agentId>:main`

Auto-reconnect uses exponential backoff (1s → 30s max). After repeated failures, the connection enters a **suspended** (circuit-breaker tripped) state and requires manual resume from the sidebar or Settings.

---

## Security

The dashboard implements a layered client-side security model:

- **Transport validation** — blocks non-loopback `ws://` URLs; requires `wss://` in production (break-glass override available in Settings)
- **Input validation** — all user input validated before reaching RPC (`validateChatMessage`, `validateCronId`)
- **Input sanitization** — chat messages trimmed and clamped to 4,000 chars via `sanitizeText`
- **Rate limiting** — `TokenBucketRateLimiter` on `chat.send` (burst 5, refill 0.5/s); visual dot indicator in chat UI
- **Security audit log** — `auditStore` records `connect`, `disconnect`, `chat.send`, `cron.toggle`, `cron.run`, `settings.save` to `sessionStorage` (max 500 entries, clears on tab close, never stores token values); viewable in Settings
- **Circuit breaker** — connection suspended after repeated gateway failures; manual resume required
- **Content Security Policy** — `default-src 'self'`, blocks framing (`frame-ancestors 'none'`), restricts connect to `ws:/wss:` only
- **Security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (geo/mic/camera/payment disabled) applied in both dev server and preview via `vite.config.ts`

---

## Internationalization

Three locales supported out of the box: **en-US**, **pt-BR**, **es**.

Ten translation namespaces: `common`, `dashboard`, `agents`, `chat`, `crons`, `kanban`, `office3d`, `health`, `settings`, `charts`, `errors`.

```bash
# Validate all locale files have matching keys
npm run i18n:validate
```

Locale files live under `src/locales/<locale>/<namespace>.json`. When adding keys, update all three locales and run the validation script.

---

## Design System

**Industrial Command Center** aesthetic:

| Token | Value | Role |
|---|---|---|
| Base background | `#0D0F14` | Dark charcoal |
| Surface | `#151820` | Cards, panels |
| Accent | `#00E5FF` | Electric cyan — primary actions, highlights |
| Warning | `#FFB300` | Amber — warnings, insecure state |
| Success | `#00E676` | Green — connected, healthy |
| Error | `#FF1744` | Red — failures |
| Display font | Space Grotesk | Headings, labels |
| Mono font | IBM Plex Mono | Code, values, timestamps |

All tokens defined as CSS variables in `src/styles/index.css`. All component styles use **CSS Modules** — no global class pollution.

---

## Build

The production bundle is split into focused chunks for optimal loading:

| Chunk | Contents |
|---|---|
| `vendor-react` | React + React DOM + React Router |
| `vendor-three` | Three.js + React Three Fiber + Drei (loaded only on `/office`) |
| `vendor-recharts` | Recharts + D3 internals |
| `vendor-dndkit` | @dnd-kit (loaded only on `/board`) |
| `vendor-i18n` | i18next + react-i18next |
| `vendor-misc` | Zustand + other small libs |

Per-page JS (e.g. `ChatPage`, `AgentsPage`) is lazy-loaded via `React.lazy` + `Suspense`.
