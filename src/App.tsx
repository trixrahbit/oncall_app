import React from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import {
  Button,
  makeStyles,
  tokens,
  Avatar,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
} from '@fluentui/react-components';
import { useThemeMode } from './theme';
import UsersPage from './pages/Users';
import RolesPage from './pages/Roles';
import CalendarPage from './pages/Calendar';
import SettingsPage from './pages/Settings';
import MySchedulePage from './pages/MySchedule';
import IncidentsPage from './pages/Incidents';
import AlertsPage from './pages/Alerts';
import RequireAuth from './components/RequireAuth';
import { useApi, WhoAmI } from './apiClient';

const useStyles = makeStyles({
  layout: {
    display: 'grid',
    gridTemplateRows: '56px 1fr',
    gridTemplateColumns: '240px 1fr',
    gridTemplateAreas: "'header header' 'sidenav main'",
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  layoutNoNav: {
    display: 'grid',
    gridTemplateRows: '56px 1fr',
    gridTemplateColumns: '1fr',
    gridTemplateAreas: "'header' 'main'",
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    gridArea: 'header',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontWeight: 700,
    color: tokens.colorNeutralForeground1,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 12,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    gridArea: 'sidenav',
  },
  main: { padding: 24, overflow: 'auto', gridArea: 'main' },
  link: {
    textDecoration: 'none',
    color: tokens.colorNeutralForeground1,
    padding: '8px 10px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  linkActive: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorBrandForeground1,
    fontWeight: 600,
  },
  settingsRow: {
    textDecoration: 'none',
    color: tokens.colorNeutralForeground1,
    padding: '8px 10px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'default',
  },
  caretButton: {
    border: 'none',
    background: 'transparent',
    color: tokens.colorNeutralForeground1,
    width: 24,
    height: 24,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 4,
    cursor: 'pointer',
  },
  settingsLabel: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subLink: {
    textDecoration: 'none',
    color: tokens.colorNeutralForeground1,
    padding: '6px 10px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
    fontSize: '0.95em',
  },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorPaletteBlueBackground2} 100%)`,
    boxShadow: tokens.shadow2,
  },
  // container inside main to softly center content on wide screens and ensure gutters
  mainInner: {
    width: '100%',
    maxWidth: 1200,
    margin: '0 auto',
    paddingLeft: 24,
    paddingRight: 24,
    boxSizing: 'border-box',
  },
});

function HeaderNav() {
  const styles = useStyles();
  const { instance, accounts } = useMsal();
  const isAuth = useIsAuthenticated();
  const loc = useLocation();
  const { mode, toggle } = useThemeMode();
  const navigate = useNavigate();
  const account = accounts[0];
  const initials = React.useMemo(() => {
    const n = account?.name || '';
    const parts = n.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts[1]?.[0] || '';
    return (first + last).toUpperCase() || (account?.username?.[0] || 'U').toUpperCase();
  }, [account]);
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={styles.logo} aria-hidden="true" />
        <span className={styles.brand}>OnCall Admin</span>
      </div>
      <div className={styles.right}>
        {isAuth ? (
          <>
            <Button size="small" appearance="secondary" onClick={toggle} style={{ marginRight: 28 }}>
              {mode === 'dark' ? '🌙 Dark' : mode === 'light' ? '☀️ Light' : '🖥 System'}
            </Button>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance="subtle" icon={<Avatar name={account?.name} initials={initials} color="brand" size={28} />}
                        title={account?.name || account?.username || 'Account'}>
                  {account?.name || account?.username}
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem onClick={() => window.open('https://myaccount.microsoft.com/?ref=oncall', '_blank')}>View profile</MenuItem>
                  <MenuItem onClick={() => navigate('/settings')}>Settings</MenuItem>
                  <MenuDivider />
                  <MenuItem onClick={() => instance.logoutRedirect()}>Sign out</MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </>
        ) : (
          <>
            <Button size="small" appearance="secondary" onClick={toggle} style={{ marginRight: 28 }}>
              {mode === 'dark' ? '🌙 Dark' : mode === 'light' ? '☀️ Light' : '🖥 System'}
            </Button>
            <Button appearance="primary" onClick={() => instance.loginRedirect()}>Sign in</Button>
          </>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const styles = useStyles();
  const loc = useLocation();
  const isAuth = useIsAuthenticated();
  const api = useApi();
  const { instance } = useMsal();
  // Mirror RequireAuth's dev bypass so nav shows in bypassed dev sessions
  const flagBypass = ((import.meta as any).env?.VITE_DEV_BYPASS_AUTH ?? '').toString() === 'true';
  const isDevBuild = Boolean((import.meta as any).env?.DEV);
  const devBypass = isDevBuild && flagBypass;
  const showNav = isAuth || devBypass;
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const isSettingsSection = (
    loc.pathname.startsWith('/settings') ||
    loc.pathname.startsWith('/users') ||
    loc.pathname.startsWith('/roles')
  );
  const [settingsOpen, setSettingsOpen] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nav.settingsOpen');
      if (saved !== null) return saved === '1';
    } catch {}
    return isSettingsSection;
  });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await api.get<WhoAmI>('/whoami');
        if (!cancelled) setIsAdmin(!!me.is_admin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }
    if (showNav) load();
    return () => { cancelled = true; };
  }, [api, showNav]);

  // Auto-open settings when a route under it is active
  React.useEffect(() => {
    if (isSettingsSection && !settingsOpen) {
      setSettingsOpen(true);
    }
  }, [isSettingsSection, settingsOpen]);

  const toggleSettingsOpen = React.useCallback(() => {
    const next = !settingsOpen;
    setSettingsOpen(next);
    try { localStorage.setItem('nav.settingsOpen', next ? '1' : '0'); } catch {}
  }, [settingsOpen]);

  // Inactivity auto-logout: sign out after 2 hours of no user interaction (configurable)
  React.useEffect(() => {
    if (!isAuth) return;
    const minutes = Number((import.meta as any).env?.VITE_IDLE_TIMEOUT_MINUTES) || 120;
    const timeoutMs = Math.max(1, minutes) * 60 * 1000;
    let timer: number | undefined;

    const reset = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Extra guard: only logout if still authenticated
        instance.logoutRedirect().catch(() => {});
      }, timeoutMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') reset();
    };

    const events: Array<[keyof WindowEventMap, EventListener]> = [
      ['mousemove', reset],
      ['keydown', reset],
      ['click', reset],
      ['scroll', reset],
      ['touchstart', reset],
      ['focus', reset],
    ];

    events.forEach(([evt, handler]) => window.addEventListener(evt, handler, { passive: true } as any));
    document.addEventListener('visibilitychange', onVisibility);
    // Start the timer when auth becomes active
    reset();

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach(([evt, handler]) => window.removeEventListener(evt, handler));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuth, instance]);
  return (
    <div className={showNav ? styles.layout : styles.layoutNoNav}>
      <HeaderNav />
      {showNav && (
        <nav className={styles.nav}>
          <Link to="/calendar" className={`${styles.link} ${loc.pathname.startsWith('/calendar') ? styles.linkActive : ''}`}>📅 Calendar</Link>
          <Link to="/my" className={`${styles.link} ${loc.pathname.startsWith('/my') ? styles.linkActive : ''}`}>🗓️ My Schedule</Link>
          <Link to="/incidents" className={`${styles.link} ${loc.pathname.startsWith('/incidents') ? styles.linkActive : ''}`}>🧯 Incidents</Link>
          <Link to="/alerts" className={`${styles.link} ${loc.pathname.startsWith('/alerts') ? styles.linkActive : ''}`}>🚨 Alerts</Link>
          {isAdmin ? (
            <>
              <div className={`${styles.settingsRow} ${isSettingsSection ? styles.linkActive : ''}`}>
                <button
                  type="button"
                  className={styles.caretButton}
                  aria-label={settingsOpen ? 'Collapse settings' : 'Expand settings'}
                  aria-expanded={settingsOpen}
                  aria-controls="settings-sub"
                  onClick={toggleSettingsOpen}
                >
                  {settingsOpen ? '▾' : '▸'}
                </button>
                <Link to="/settings" className={styles.settingsLabel}>⚙️ Settings</Link>
              </div>
              {settingsOpen && (
                <div id="settings-sub">
                  <Link to="/users" className={`${styles.subLink} ${loc.pathname.startsWith('/users') ? styles.linkActive : ''}`}>└─ 👥 Users</Link>
                  <Link to="/roles" className={`${styles.subLink} ${loc.pathname.startsWith('/roles') ? styles.linkActive : ''}`}>└─ 🔐 Roles</Link>
                </div>
              )}
            </>
          ) : (
            <Link to="/settings" className={`${styles.link} ${loc.pathname.startsWith('/settings') ? styles.linkActive : ''}`}>⚙️ Settings</Link>
          )}
        </nav>
      )}
      <main className={styles.main}>
        <div className={styles.mainInner}>
          <Routes>
            <Route path="/" element={<Navigate to="/incidents" replace />} />
            <Route element={<RequireAuth />}> 
              <Route path="/users" element={isAdmin ? <UsersPage /> : <Navigate to="/settings" replace />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/my" element={<MySchedulePage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              {/* Alerts should be available to all users */}
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/roles" element={isAdmin ? <RolesPage /> : <Navigate to="/settings" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
