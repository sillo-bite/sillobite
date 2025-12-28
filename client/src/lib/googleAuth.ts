/**
 * Google OAuth 2.0 Authentication Service
 * All OAuth URL generation and token exchange handled by backend
 */

export const signInWithGoogle = (): void => {
  window.location.href = '/api/auth/google';
};

export const signOutGoogle = (): void => {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_id_token');
  localStorage.removeItem('user');
  localStorage.removeItem('session_timestamp');
};

export const isAuthenticated = (): boolean => {
  const user = localStorage.getItem('user');
  const sessionTimestamp = localStorage.getItem('session_timestamp');
  
  if (!user || !sessionTimestamp) {
    return false;
  }

  const sessionAge = Date.now() - parseInt(sessionTimestamp);
  const maxAge = 24 * 60 * 60 * 1000;

  if (sessionAge > maxAge) {
    signOutGoogle();
    return false;
  }

  return true;
};

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
