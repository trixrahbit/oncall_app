import { Configuration, PublicClientApplication, EventType } from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_TENANT_ID as string;
const clientId = import.meta.env.VITE_CLIENT_ID as string;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    knownAuthorities: [`login.microsoftonline.com`],
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    // Prevent MSAL from navigating back to the original request URL after login,
    // which can cause loops in some SPA router setups.
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const apiScope = (import.meta.env.VITE_API_SCOPE as string) || 'api://oncall/.default';

// IMPORTANT: Handle the redirect response on page load so MSAL completes the
// login flow and restores the authenticated account in memory. Without this,
// the app may appear to stay on the sign-in screen because isAuthenticated
// remains false after returning from Microsoft login.
msalInstance.handleRedirectPromise().then((result) => {
  const account = result?.account;
  if (account) {
    msalInstance.setActiveAccount(account);
  }
}).catch(() => {
  // Swallow errors here; they will surface during token acquisition if relevant.
});

// Ensure the active account is set after redirect/login so hooks reflect auth state
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) {
    const account = (event as any)?.payload?.account;
    if (account) {
      msalInstance.setActiveAccount(account);
    }
  }
});

// Also set an active account on startup if MSAL restored a session
const existing = msalInstance.getAllAccounts();
if (existing.length && !msalInstance.getActiveAccount()) {
  msalInstance.setActiveAccount(existing[0]);
}
