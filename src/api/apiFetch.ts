// Authenticated fetch wrapper for internal API calls.
// Adds the Authorization header required by server/middleware/auth.ts.
// In dev, Vite's proxy also injects this header — the client header is the
// fallback for production builds served outside the Vite dev server.

const DEV_DEFAULT = 'openclaw-dev-local';
const secret = import.meta.env.VITE_API_SECRET ?? DEV_DEFAULT;
const AUTH_HEADER = `Bearer ${secret}`;

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: AUTH_HEADER,
    },
  });
}
