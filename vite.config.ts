import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

// SHA-256 hash of the inline FOUC-prevention script in index.html.
// If that script ever changes, recompute with:
//   python3 -c "import hashlib,base64; s=open('index.html').read(); \
//     t=s[s.index('<script>')+8:s.index('</script>')]; \
//     print('sha256-'+base64.b64encode(hashlib.sha256(t.encode()).digest()).decode())"
const FOUC_SCRIPT_HASH = 'sha256-1vPsQXKhHBCB8MdNlxgliEHDU7d59rT8u4qRNIjDhwY=';

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    `script-src 'self' '${FOUC_SCRIPT_HASH}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss:",
    "frame-ancestors 'none'",
  ].join('; '),
};

// Dev-mode headers: omit CSP so Vite's inline React Fast Refresh script isn't blocked.
// The strict CSP only applies to production (preview / real server).
const devHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
};

export default defineConfig({
  plugins: [react()],
  server: {
    headers: devHeaders,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        headers: {
          // Inject the server auth token so browser requests don't need to carry it directly.
          // Must match OPENCLAW_API_SECRET on the server. Defaults to the same dev fallback.
          Authorization: `Bearer ${process.env.VITE_API_SECRET ?? 'openclaw-dev-local'}`,
        },
      },
    },
  },
  preview: {
    headers: securityHeaders,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Three.js + React Three Fiber + Drei → loaded only on /office
          if (
            id.includes('node_modules/three') ||
            id.includes('node_modules/@react-three')
          ) {
            return 'vendor-three';
          }
          // Recharts + its d3 internals
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-recharts';
          }
          // dnd-kit (Kanban board)
          if (id.includes('node_modules/@dnd-kit')) {
            return 'vendor-dndkit';
          }
          // React core + router
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor-react';
          }
          // i18next + react-i18next — separate chunk so locale bundles can load async
          if (
            id.includes('node_modules/i18next') ||
            id.includes('node_modules/react-i18next')
          ) {
            return 'vendor-i18n';
          }
          // Zustand + other small libs
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
})
