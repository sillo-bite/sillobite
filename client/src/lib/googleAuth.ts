/**
 * Google OAuth 2.0 Authentication Service
 *
 * SECURITY NOTES:
 * - All token exchange is handled server-side only. Raw Google tokens
 *   (access_token, id_token, refresh_token) never reach the browser.
 * - The canonical login flow is the server redirect:
 *     signInWithGoogle() → GET /api/auth/google → Google → GET /callback
 *   The server sets a session cookie after verifying the ID token.
 *   The frontend then calls GET /api/auth/session to get the user.
 * - handleGoogleRedirect() and signInWithGooglePopup() previously returned
 *   raw tokens to the browser — they have been removed.
 */

/**
 * Initiates the Google OAuth redirect flow.
 * Saves an optional post-login redirect URL to sessionStorage so it can be
 * restored in OAuthCallback after the server redirects back.
 */
export const signInWithGoogle = (redirectUrl?: string | null): void => {
  let redirect = redirectUrl;
  if (!redirect) {
    const urlParams = new URLSearchParams(window.location.search);
    redirect = urlParams.get('redirect');
  }

  if (redirect) {
    sessionStorage.setItem('authRedirect', redirect);
  } else {
    sessionStorage.removeItem('authRedirect');
  }

  // Navigate to the server-side OAuth initiation endpoint.
  // The server generates a CSRF state nonce, stores it in the session,
  // and redirects to Google with the nonce in the `state` param.
  window.location.href = '/api/auth/google';
};

/**
 * Destroys the server session and clears all local auth state.
 * Should be called by every logout handler in the app.
 *
 * The fetch is fire-and-forget — even if it fails, local state is cleared
 * and the server session will expire naturally within 24 hours.
 */
export const signOutGoogle = (): void => {
  fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {
    // Server session will expire on its own — this is safe to ignore
  });

  // Clear all local auth state
  localStorage.removeItem('user');
  localStorage.removeItem('session_timestamp');
  localStorage.removeItem('last_activity');
  // Legacy keys — kept for safety in case they exist from old sessions
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_id_token');
};

/**
 * Checks whether the local auth state is still within its 24-hour TTL.
 * This is a client-side cache check only — it does not verify the server
 * session. Use GET /api/auth/session for authoritative session status.
 */
export const isAuthenticated = (): boolean => {
  const user = localStorage.getItem('user');
  const sessionTimestamp = localStorage.getItem('session_timestamp');

  if (!user || !sessionTimestamp) {
    return false;
  }

  const sessionAge = Date.now() - parseInt(sessionTimestamp);
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours — matches server session TTL

  if (sessionAge > maxAge) {
    signOutGoogle();
    return false;
  }

  return true;
};

/**
 * Returns the locally cached user object if the local session is still valid.
 * Use GET /api/auth/session for authoritative user data from the server.
 */
export const getCurrentUser = (): any => {
  if (!isAuthenticated()) {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};
