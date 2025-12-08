import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';

export default function RequireAuth() {
  const isAuth = useIsAuthenticated();
  const { instance } = useMsal();
  const loc = useLocation();

  React.useEffect(() => {
    if (!isAuth) {
      instance.loginRedirect({});
    }
  }, [isAuth, instance]);

  if (!isAuth) {
    return <Navigate to={loc.pathname} replace />;
  }
  return <Outlet />;
}
