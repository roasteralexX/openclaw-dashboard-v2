import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const tickets = sqliteTable('board_tickets', {
  id:             text('id').primaryKey(),
  title:          text('title').notNull(),
  description:    text('description').default(''),
  column:         text('column').notNull().default('backlog'),
  priority:       text('priority').notNull().default('P2'),
  assigneeId:     text('assignee_id'),
  agentId:        text('agent_id'),
  labels:         text('labels').default('[]'),    // JSON array
  createdAt:      text('created_at').notNull(),
  updatedAt:      text('updated_at').notNull(),
  dueDate:        text('due_date'),
  pnl:            text('pnl'),
  estimatedHours: real('estimated_hours'),
  comments:       text('comments').default('[]'),  // JSON array
});

export const chatMessages = sqliteTable('chat_messages', {
  id:         text('id').primaryKey(),
  sessionKey: text('session_key').notNull(),  // 'agent:<id>:main'
  role:       text('role').notNull(),         // user | assistant | system
  content:    text('content').notNull(),
  timestamp:  text('timestamp').notNull(),
  failed:     integer('failed', { mode: 'boolean' }).default(false),
  runId:      text('run_id'),
});

export const auditLog = sqliteTable('audit_log', {
  id:        text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  action:    text('action').notNull(),
  detail:    text('detail').notNull(),
  wsUrl:     text('ws_url'),
});

export const officeDesks = sqliteTable('office_desks', {
  id:       text('id').primaryKey(),
  agentId:  text('agent_id'),
  posX:     real('pos_x').notNull().default(0),
  posY:     real('pos_y').notNull().default(0),
  posZ:     real('pos_z').notNull().default(0),
  rotation: real('rotation').notNull().default(0),
  label:    text('label'),
});
