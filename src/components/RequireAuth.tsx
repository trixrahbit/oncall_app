import React from 'react';
import { Outlet } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { Button, tokens } from '@fluentui/react-components';

export default function RequireAuth() {
  const isAuth = useIsAuthenticated();
  const { instance } = useMsal();

  // Allow bypass in local dev if enabled, or automatically when running on localhost
  // Previous behavior bypassed auth automatically on localhost, which made it
  // impossible to test auth locally with the flag turned off. Now we only bypass
  // when BOTH running a dev build and the explicit flag is set to true.
  const flagBypass = ((import.meta as any).env?.VITE_DEV_BYPASS_AUTH ?? '').toString() === 'true';
  const isDevBuild = Boolean((import.meta as any).env?.DEV);
  const devBypass = isDevBuild && flagBypass;

  if (devBypass) return <Outlet />;

  if (!isAuth) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          boxSizing: 'border-box',
          background: tokens.colorNeutralBackground2,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            background: tokens.colorNeutralBackground1,
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            borderRadius: 12,
            boxShadow: tokens.shadow16,
            padding: 28,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              margin: '0 auto 12px',
              background: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorPaletteBlueBackground2} 100%)`,
              boxShadow: tokens.shadow4,
            }}
            aria-hidden="true"
          />
          <h2 style={{ margin: '8px 0 4px' }}>Welcome to OnCall Admin</h2>
          <p style={{ margin: '0 0 20px', color: tokens.colorNeutralForeground3 }}>
            Please sign in with your Microsoft account to continue.
          </p>
          <Button size="large" appearance="primary" onClick={() => instance.loginRedirect({})}>
            Sign in
          </Button>
          <div style={{ marginTop: 16, color: tokens.colorNeutralForeground3, fontSize: 12 }}>
            By signing in, you agree to the acceptable use policy.
          </div>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
