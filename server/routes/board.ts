import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tickets } from '../db/schema.js';

const board = new Hono();

// GET /api/board/tickets
board.get('/tickets', (c) => {
  const rows = db.select().from(tickets).all();
  const result = rows.map((r) => ({
    ...r,
    labels:   JSON.parse(r.labels   ?? '[]'),
    comments: JSON.parse(r.comments ?? '[]'),
  }));
  return c.json(result);
});

// POST /api/board/tickets
board.post('/tickets', async (c) => {
  const body = await c.req.json<{
    id: string; title: string; description?: string; column: string;
    priority: string; assigneeId?: string; agentId?: string;
    labels?: string[]; createdAt: string; updatedAt: string;
    dueDate?: string; pnl?: string; estimatedHours?: number;
    comments?: unknown[];
  }>();

  db.insert(tickets).values({
    id:             body.id,
    title:          body.title,
    description:    body.description ?? '',
    column:         body.column,
    priority:       body.priority,
    assigneeId:     body.assigneeId ?? null,
    agentId:        body.agentId ?? null,
    labels:         JSON.stringify(body.labels ?? []),
    createdAt:      body.createdAt,
    updatedAt:      body.updatedAt,
    dueDate:        body.dueDate ?? null,
    pnl:            body.pnl ?? null,
    estimatedHours: body.estimatedHours ?? null,
    comments:       JSON.stringify(body.comments ?? []),
  }).run();

  return c.json({ ok: true }, 201);
});

// PUT /api/board/tickets/:id
board.put('/tickets/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const patch: Record<string, unknown> = {};
  if (body.title          !== undefined) patch.title          = body.title;
  if (body.description    !== undefined) patch.description    = body.description;
  if (body.column         !== undefined) patch.column         = body.column;
  if (body.priority       !== undefined) patch.priority       = body.priority;
  if (body.assigneeId     !== undefined) patch.assigneeId     = body.assigneeId;
  if (body.agentId        !== undefined) patch.agentId        = body.agentId;
  if (body.dueDate        !== undefined) patch.dueDate        = body.dueDate;
  if (body.pnl            !== undefined) patch.pnl            = body.pnl;
  if (body.estimatedHours !== undefined) patch.estimatedHours = body.estimatedHours;
  if (body.labels         !== undefined) patch.labels         = JSON.stringify(body.labels);
  if (body.comments       !== undefined) patch.comments       = JSON.stringify(body.comments);
  patch.updatedAt = new Date().toISOString();

  db.update(tickets).set(patch).where(eq(tickets.id, id)).run();
  return c.json({ ok: true });
});

// DELETE /api/board/tickets/:id
board.delete('/tickets/:id', (c) => {
  const id = c.req.param('id');
  db.delete(tickets).where(eq(tickets.id, id)).run();
  return c.json({ ok: true });
});

export default board;
