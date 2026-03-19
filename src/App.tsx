import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/shell/AppShell';

/* ── Lazy route chunks ───────────────────────────── */
// Each page is its own async chunk.
// OfficePage pulls Three.js/R3F (~750 KB) only when the /office route is visited.
// Recharts-heavy pages (Overview, Agents) split from the shell.

const OverviewPage  = lazy(() => import('./modules/overview/OverviewPage'));
const AgentsPage    = lazy(() => import('./modules/agents/AgentsPage'));
const CronsPage     = lazy(() => import('./modules/crons/CronsPage'));
const OfficePage    = lazy(() => import('./modules/office/OfficePage'));
const BoardPage     = lazy(() => import('./modules/board/BoardPage'));
const SettingsPage  = lazy(() => import('./modules/settings/SettingsPage'));
const ChatPage      = lazy(() => import('./modules/chat/ChatPage'));
const HealthPage    = lazy(() => import('./modules/health/HealthPage'));

/* ── Page loader fallback ────────────────────────── */

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: 240,
      color: 'var(--c-text-muted)',
      fontSize: 'var(--fs-sm)',
      fontFamily: 'var(--ff-mono)',
      gap: '8px',
    }}>
      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⬡</span>
      Loading…
    </div>
  );
}

/* ── App ─────────────────────────────────────────── */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={
            <Suspense fallback={<PageLoader />}><OverviewPage /></Suspense>
          } />
          <Route path="agents" element={
            <Suspense fallback={<PageLoader />}><AgentsPage /></Suspense>
          } />
          <Route path="crons" element={
            <Suspense fallback={<PageLoader />}><CronsPage /></Suspense>
          } />
          <Route path="office" element={
            <Suspense fallback={<PageLoader />}><OfficePage /></Suspense>
          } />
          <Route path="board" element={
            <Suspense fallback={<PageLoader />}><BoardPage /></Suspense>
          } />
          <Route path="settings" element={
            <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>
          } />
          <Route path="chat" element={
            <Suspense fallback={<PageLoader />}><ChatPage /></Suspense>
          } />
          <Route path="health" element={
            <Suspense fallback={<PageLoader />}><HealthPage /></Suspense>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
