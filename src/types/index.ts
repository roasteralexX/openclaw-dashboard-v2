/* ══════════════════════════════════════════════════════
   OpenClaw Gateway Protocol Types
   ══════════════════════════════════════════════════════ */

/** Gateway session (maps to an agent context) */
export interface GatewaySession {
  sessionKey: string;
  agentId: string;
  channel: string;
  peer?: string;
  model?: string;
  createdAt?: string;
  lastMessageAt?: string;
  messageCount?: number;
}

/** Gateway channel status */
export interface GatewayChannel {
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'pairing';
  connectedAt?: string;
  error?: string;
}

/** Gateway cron job */
export interface GatewayCron {
  id: string;
  expression: string;
  agent?: string;
  delivery: string;
  enabled: boolean;
  prompt?: string;
  label?: string;
  lastRun?: string;
  nextRun?: string;
  history?: GatewayCronRun[];
}

export interface GatewayCronRun {
  id: string;
  cronId: string;
  startedAt: string;
  completedAt?: string;
  status: 'success' | 'failed' | 'running' | 'skipped';
  duration?: number;
  error?: string;
}

/** Gateway health response */
export interface GatewayHealth {
  uptime?: number;
  version?: string;
  protocol?: number;
  channels?: Record<string, GatewayChannel>;
  models?: string[];
  sessionCount?: number;
  nodeCount?: number;
}

/** Gateway node (macOS, iOS, Android, headless) */
export interface GatewayNode {
  id: string;
  platform?: string;
  caps?: string[];
  connectedAt?: string;
  deviceFamily?: string;
}

/* ── Agent Types ───────────────────────────────────── */

export type AgentStatus = 'active' | 'idle' | 'error' | 'offline';

export interface AgentAction {
  id: string;
  timestamp: string;
  type: 'task' | 'cron' | 'api_call' | 'error' | 'info';
  description: string;
  tokensUsed?: number;
  duration?: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  avatar?: string;
  lastAction?: string;
  lastActionTime?: string;
  tokensUsedToday: number;
  tokensUsedTotal: number;
  actions: AgentAction[];
  tokenHistory: { date: string; tokens: number }[];
  deskId?: string;
}

/* ── Cron Types ────────────────────────────────────── */

export type CronStatus = 'success' | 'failed' | 'running' | 'scheduled';

export interface CronExecution {
  id: string;
  startTime: string;
  endTime?: string;
  status: CronStatus;
  duration?: number;
  output?: string;
  error?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  agentId: string;
  description: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  executions: CronExecution[];
}

/* ── Board / Ticket Types ─────────────────────────── */

export type TicketPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type TicketColumn = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TicketLabel = 'feature' | 'bug' | 'improvement' | 'research' | 'blocked';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  ticketCount: number;
}

export interface TicketComment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface BoardFilter {
  search: string;
  priorities: TicketPriority[];
  labels: TicketLabel[];
  assigneeId: string | null;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  column: TicketColumn;
  priority: TicketPriority;
  assigneeId?: string;
  agentId?: string;
  labels: TicketLabel[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  estimatedHours?: number;
  comments?: TicketComment[];
}

/* ── 3D Office Types ──────────────────────────────── */

export interface DeskPosition {
  x: number;
  y: number;
  z: number;
}

export interface OfficeDesk {
  id: string;
  agentId?: string;
  position: DeskPosition;
  rotation: number;
  label?: string;
}

/* ── Connection / Settings Types ──────────────────── */

export interface ConnectionConfig {
  wsUrl: string;
  authToken?: string;
  isConnected: boolean;
  lastPing?: string;
}
