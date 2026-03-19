import type { MiddlewareHandler } from 'hono';

// Shared secret for internal API access.
// Must match OPENCLAW_API_SECRET env var on the server and
// VITE_API_SECRET env var on the client/proxy side.
// In development, defaults to a known dev token — set a real secret in production.
const DEV_DEFAULT = 'openclaw-dev-local';

export const API_SECRET = process.env.OPENCLAW_API_SECRET ?? DEV_DEFAULT;

if (API_SECRET === DEV_DEFAULT) {
  console.warn('[auth] OPENCLAW_API_SECRET not set — using default dev token.');
  console.warn('[auth] Set OPENCLAW_API_SECRET=<strong-secret> in production.');
}

export const apiAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('Authorization');
  if (auth !== `Bearer ${API_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};
