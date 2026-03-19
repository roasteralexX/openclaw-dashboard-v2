import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { officeDesks } from '../db/schema.js';

const office = new Hono();

// Default desk layout — mirrors src/api/mock.ts mockDesks
const DEFAULT_DESKS = [
  { id: 'desk-1', agentId: 'agent-1', posX: -4, posY: 0, posZ: -2, rotation: 0,            label: 'Sentinel' },
  { id: 'desk-2', agentId: 'agent-2', posX:  0, posY: 0, posZ: -2, rotation: 0,            label: 'Oracle'   },
  { id: 'desk-3', agentId: 'agent-3', posX:  4, posY: 0, posZ: -2, rotation: 0,            label: 'Executor' },
  { id: 'desk-4', agentId: 'agent-4', posX: -4, posY: 0, posZ:  2, rotation: Math.PI,      label: 'Guardian' },
  { id: 'desk-5', agentId: 'agent-5', posX:  0, posY: 0, posZ:  2, rotation: Math.PI,      label: 'Scribe'   },
  { id: 'desk-6', agentId: 'agent-6', posX:  4, posY: 0, posZ:  2, rotation: Math.PI,      label: 'Phantom'  },
];

// GET /api/office/desks
office.get('/desks', (c) => {
  let rows = db.select().from(officeDesks).all();

  // Seed defaults on first run
  if (rows.length === 0) {
    db.insert(officeDesks).values(DEFAULT_DESKS).run();
    rows = db.select().from(officeDesks).all();
  }

  // Map flat columns back to nested position object
  const result = rows.map((r) => ({
    id:       r.id,
    agentId:  r.agentId,
    label:    r.label,
    rotation: r.rotation,
    position: { x: r.posX, y: r.posY, z: r.posZ },
  }));

  return c.json(result);
});

// PUT /api/office/desks/:id
office.put('/desks/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    position?: { x: number; y: number; z: number };
    rotation?: number;
    label?: string;
  }>();

  const patch: Record<string, unknown> = {};
  if (body.position !== undefined) {
    patch.posX = body.position.x;
    patch.posY = body.position.y;
    patch.posZ = body.position.z;
  }
  if (body.rotation !== undefined) patch.rotation = body.rotation;
  if (body.label    !== undefined) patch.label    = body.label;

  db.update(officeDesks).set(patch).where(eq(officeDesks.id, id)).run();
  return c.json({ ok: true });
});

// POST /api/office/desks/reset
office.post('/desks/reset', (c) => {
  db.delete(officeDesks).run();
  db.insert(officeDesks).values(DEFAULT_DESKS).run();
  const rows = db.select().from(officeDesks).all();
  const result = rows.map((r) => ({
    id:       r.id,
    agentId:  r.agentId,
    label:    r.label,
    rotation: r.rotation,
    position: { x: r.posX, y: r.posY, z: r.posZ },
  }));
  return c.json(result);
});

export default office;
