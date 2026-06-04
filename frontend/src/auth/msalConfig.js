/**
 * Microsoft Entra ID (Azure AD) MSAL Configuration
 *
 * Set these environment variables in your .env / .env.production:
 *   VITE_AZURE_CLIENT_ID  = Application (client) ID from App Registration
 *   VITE_AZURE_TENANT_ID  = Directory (tenant) ID from Entra ID
 */

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || '';

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

/** True only when both env vars are provided */
export const isSSOEnabled = Boolean(clientId && tenantId);
