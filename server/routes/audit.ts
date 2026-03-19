import { Hono } from 'hono';
import { db } from '../db/client.js';
import { auditLog } from '../db/schema.js';

const audit = new Hono();

// GET /api/audit
audit.get('/', (c) => {
  const rows = db.select().from(auditLog).all();
  return c.json(rows);
});

// POST /api/audit
audit.post('/', async (c) => {
  const body = await c.req.json<{
    id: string; timestamp: string; action: string; detail: string; wsUrl?: string;
  }>();

  db.insert(auditLog).values({
    id:        body.id,
    timestamp: body.timestamp,
    action:    body.action,
    detail:    body.detail,
    wsUrl:     body.wsUrl ?? null,
  }).run();

  return c.json({ ok: true }, 201);
});

// DELETE /api/audit
audit.delete('/', (c) => {
  db.delete(auditLog).run();
  return c.json({ ok: true });
});

export default audit;
