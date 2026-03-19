import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import ToastContainer from '../shared/ToastContainer';
import EventFeed from './EventFeed';
import { useGatewayEvents } from '../../hooks/useGatewayEvents';
import { useAuditStore } from '../../store/auditStore';
import { useOfficeStore } from '../../store/officeStore';
import { useBoardStore } from '../../store/boardStore';
import styles from './AppShell.module.css';

export default function AppShell() {
  // Subscribe to gateway events at the root level
  useGatewayEvents();

  // Bootstrap persistent data from SQLite on app mount
  useEffect(() => {
    void useAuditStore.getState().init();
    void useOfficeStore.getState().fetchDesks();
    void useBoardStore.getState().fetchTickets();
  }, []);

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar />
        <main className={styles.content}>
          <Outlet />
        </main>
        <Footer />
      </div>
      <ToastContainer />
      <EventFeed />
    </div>
  );
}

