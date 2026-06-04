import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig, isSSOEnabled } from './auth/msalConfig'
import './index.css'
import App from './App.jsx'

const tree = (msalInstance) => (
  <StrictMode>
    {msalInstance
      ? <MsalProvider instance={msalInstance}><App /></MsalProvider>
      : <App />
    }
  </StrictMode>
);

/**
 * MSAL v5 popup auth callback handler.
 *
 * How MSAL v5's popup flow actually works:
 *   1. The PARENT window calls loginPopup(), opens the popup, then waits (up to
 *      ~60s) listening on a BroadcastChannel keyed by an id embedded in the
 *      `state` param.
 *   2. Microsoft authenticates the user and redirects the POPUP back to our
 *      redirectUri (https://hrms.witzonetech.com) with the auth response in the
 *      URL — either #code=...&state=... (fragment) or ?code=...&state=... (query).
 *   3. The popup MUST post that raw response back to the parent over that same
 *      BroadcastChannel, then close itself. The standalone function that does
 *      exactly this is broadcastResponseToMainFrame() from the redirect-bridge.
 *
 * Critically: handleRedirectPromise() is for the MAIN-FRAME *redirect* flow and
 * does NOT broadcast to the popup channel — using it here is why the parent
 * timed out. We must use the redirect bridge instead.
 *
 * This must run before React Router mounts (it would navigate and wipe the hash).
 *
 * Returns true if it handled (and is closing) the popup — caller should stop.
 */
async function handlePopupAuthCallback() {
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  // A real MSAL auth response always carries BOTH a code/error/id_token AND state.
  const looksLikeCallback =
    (/[#&](code|error|id_token)=/.test(hash) && /[#&]state=/.test(hash)) ||
    (/[?&](code|error)=/.test(search)        && /[?&]state=/.test(search));

  if (!looksLikeCallback) return false;

  try {
    const { broadcastResponseToMainFrame } = await import('@azure/msal-browser/redirect-bridge');
    // Reads the auth response from this popup's URL, posts it to the parent's
    // BroadcastChannel (keyed by the state id), then calls window.close().
    await broadcastResponseToMainFrame();
  } catch (e) {
    // Not a valid MSAL response after all, or bridge failed — log and let the
    // popup show a blank page; the parent will time out and surface the error.
    console.error('[SSO] redirect bridge failed', e);
  }
  return true;
}

async function bootstrap() {
  const root = createRoot(document.getElementById('root'));

  // If we're inside the SSO popup (Microsoft just redirected back), broadcast the
  // auth response to the opener and close — do NOT mount the SPA in the popup.
  if (isSSOEnabled) {
    const handled = await handlePopupAuthCallback();
    if (handled) {
      root.render(
        <div style={{ background: '#070B14', height: '100vh', width: '100vw' }} />
      );
      return;
    }
  }

  if (isSSOEnabled) {
    try {
      const msalInstance = new PublicClientApplication(msalConfig);
      await msalInstance.initialize(); // Required for msal-browser v3+
      root.render(tree(msalInstance));
    } catch (e) {
      console.error('MSAL init failed, falling back to password login', e);
      root.render(tree(null));
    }
  } else {
    root.render(tree(null));
  }
}

bootstrap();
