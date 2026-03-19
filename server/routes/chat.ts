import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { chatMessages } from '../db/schema.js';

const chat = new Hono();

// GET /api/chat/messages/:sessionKey
chat.get('/messages/:sessionKey', (c) => {
  const sessionKey = c.req.param('sessionKey');
  const rows = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionKey, sessionKey))
    .all();
  return c.json(rows);
});

// POST /api/chat/messages
chat.post('/messages', async (c) => {
  const body = await c.req.json<{
    id: string; sessionKey: string; role: string;
    content: string; timestamp: string; failed?: boolean; runId?: string;
  }>();

  db.insert(chatMessages).values({
    id:         body.id,
    sessionKey: body.sessionKey,
    role:       body.role,
    content:    body.content,
    timestamp:  body.timestamp,
    failed:     body.failed ?? false,
    runId:      body.runId ?? null,
  }).run();

  return c.json({ ok: true }, 201);
});

// DELETE /api/chat/messages/:sessionKey
chat.delete('/messages/:sessionKey', (c) => {
  const sessionKey = c.req.param('sessionKey');
  db.delete(chatMessages).where(eq(chatMessages.sessionKey, sessionKey)).run();
  return c.json({ ok: true });
});

export default chat;
