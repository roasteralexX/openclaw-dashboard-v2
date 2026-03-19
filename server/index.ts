import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './db/client.js';
import board  from './routes/board.js';
import chat   from './routes/chat.js';
import audit  from './routes/audit.js';
import office from './routes/office.js';
import { apiAuth } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;

// Run migrations on startup
migrate(db, { migrationsFolder: join(__dirname, 'db/migrations') });
console.log('[db] Migrations applied.');

const app = new Hono();

// All /api/* routes require a valid Bearer token (see server/middleware/auth.ts)
app.use('/api/*', apiAuth);

app.route('/api/board',  board);
app.route('/api/chat',   chat);
app.route('/api/audit',  audit);
app.route('/api/office', office);

app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[server] OpenClaw API running on http://localhost:${PORT}`);
});
