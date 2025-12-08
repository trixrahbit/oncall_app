import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { Button, makeStyles, tokens } from '@fluentui/react-components';
import UsersPage from './pages/Users';
import CalendarPage from './pages/Calendar';
import SettingsPage from './pages/Settings';
import RequireAuth from './components/RequireAuth';

const useStyles = makeStyles({
  layout: { display: 'grid', gridTemplateRows: '56px 1fr', height: '100vh' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  nav: { display: 'flex', gap: 12, alignItems: 'center' },
  main: { padding: 16, overflow: 'auto' },
  link: { textDecoration: 'none', color: tokens.colorNeutralForeground1 },
  active: { fontWeight: 600, color: tokens.colorBrandForeground1 },
});

function HeaderNav() {
  const styles = useStyles();
  const { instance, accounts } = useMsal();
  const isAuth = useIsAuthenticated();
  const loc = useLocation();
  const account = accounts[0];
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <span style={{ fontWeight: 700 }}>OnCall Admin</span>
        <Link to="/users" className={`${styles.link} ${loc.pathname.startsWith('/users') ? styles.active : ''}`}>Users</Link>
        <Link to="/calendar" className={`${styles.link} ${loc.pathname.startsWith('/calendar') ? styles.active : ''}`}>Calendar</Link>
        <Link to="/settings" className={`${styles.link} ${loc.pathname.startsWith('/settings') ? styles.active : ''}`}>Settings</Link>
      </nav>
      <div>
        {isAuth ? (
          <>
            <span style={{ marginRight: 12 }}>{account?.name}</span>
            <Button appearance="secondary" onClick={() => instance.logoutRedirect()}>Sign out</Button>
          </>
        ) : (
          <Button appearance="primary" onClick={() => instance.loginRedirect()}>Sign in</Button>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const styles = useStyles();
  return (
    <div className={styles.layout}>
      <HeaderNav />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/users" replace />} />
          <Route element={<RequireAuth />}> 
            <Route path="/users" element={<UsersPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
