/**
 * Google OAuth 2.0 Authentication Service
 * Simplified client-side implementation - OAuth URL generation handled by backend
 */

// Handle Google OAuth redirect
export const handleGoogleRedirect = async (): Promise<{
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  accessToken: string;
} | null> => {
  if (window.location.pathname !== '/auth/callback' && window.location.pathname !== '/api/auth/google/callback') {
    return null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }

  if (!code) {
    return null;
  }

  try {
    console.log('Starting OAuth token exchange...');
    console.log('Authorization code:', code ? 'present' : 'missing');
    
    const tokenResponse = await fetch('/api/auth/google/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code })
    });

    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      throw new Error(`Failed to exchange code for token: ${errorData.error || 'Unknown error'}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, id_token } = tokenData;
    console.log('Token exchange successful');

    console.log('Fetching user info...');
    const userResponse = await fetch('/api/auth/google/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token,
        id_token
      })
    });

    console.log('User response status:', userResponse.status);

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error('User info fetch failed:', errorData);
      throw new Error(`Failed to get user info: ${errorData.error || 'Unknown error'}`);
    }

    const userData = await userResponse.json();
    console.log('User info fetched successfully:', userData);

    return {
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture
      },
      accessToken: access_token
    };
  } catch (error) {
    console.error('Google OAuth redirect error:', error);
    throw error;
  }
};

// Sign in with Google (redirect method)
export const signInWithGoogle = (): void => {
  window.location.href = '/api/auth/google';
};

// Sign in with Google (popup method)
export const signInWithGooglePopup = async (): Promise<{
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  accessToken: string;
} | null> => {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      '/api/auth/google',
      'google-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      reject(new Error('Popup blocked'));
      return;
    }

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        reject(new Error('Popup closed'));
      }
    }, 1000);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        clearInterval(checkClosed);
        popup.close();
        window.removeEventListener('message', handleMessage);
        resolve(event.data.user);
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        clearInterval(checkClosed);
        popup.close();
        window.removeEventListener('message', handleMessage);
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener('message', handleMessage);
  });
};

// Sign out (clear local storage)
export const signOutGoogle = (): void => {
  // Clear any stored tokens
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_id_token');
  localStorage.removeItem('user');
  localStorage.removeItem('session_timestamp');
  
  // Redirect to Google logout (optional)
  // window.location.href = 'https://accounts.google.com/logout';
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const user = localStorage.getItem('user');
  const sessionTimestamp = localStorage.getItem('session_timestamp');
  
  if (!user || !sessionTimestamp) {
    return false;
  }

  // Check if session is expired (24 hours)
  const sessionAge = Date.now() - parseInt(sessionTimestamp);
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (sessionAge > maxAge) {
    signOutGoogle();
    return false;
  }

  return true;
};

// Get current user
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
