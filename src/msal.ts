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

// Initialize MSAL and complete redirect processing before React renders,
// so that an active account is reliably available to hooks on first paint.
(async () => {
  try {
    await msalInstance.initialize();
  } catch (e) {
    // no-op: MSAL will throw if double-initialized; safe to ignore
  }

  try {
    const result = await msalInstance.handleRedirectPromise();
    const account = result?.account;
    if (account) {
      msalInstance.setActiveAccount(account);
    }
  } catch {
    // Swallow errors here; they will surface during token acquisition if relevant.
  }

  // Ensure an existing cached account is set active on startup
  const existing = msalInstance.getAllAccounts();
  if (existing.length && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(existing[0]);
  }
})();

// Also keep active account in sync after login/token events
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) {
    const account = (event as any)?.payload?.account;
    if (account) {
      msalInstance.setActiveAccount(account);
    }
  }
});
