/**
 * Google OAuth 2.0 Server Routes
 * Handles token exchange and user info retrieval
 */

import { Router } from 'express';

const router = Router();


// Initiate Google OAuth flow
router.get('/', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Handle Google OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

    if (error) {
      console.error('OAuth error:', error);
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || typeof code !== 'string') {
      console.error('No authorization code provided');
      return res.redirect(`${frontendUrl}/auth/callback?error=no_code`);
    }

    console.log('OAuth callback - exchanging code for tokens');

    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!
    });

    if (!tokens.id_token) {
      console.error('No ID token received');
      return res.redirect(`${frontendUrl}/auth/callback?error=no_id_token`);
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload) {
      console.error('No payload in ID token');
      return res.redirect(`${frontendUrl}/auth/callback?error=invalid_token`);
    }

    const userData = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified
    };

    console.log('User authenticated:', { email: userData.email });

    if (req.session) {
      req.session.googleUser = userData;
    }

    const params = new URLSearchParams({
      email: userData.email || '',
      name: userData.name || '',
      picture: userData.picture || '',
      id: userData.id || ''
    });

    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const errorMessage = error?.message || 'authentication_failed';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
  }
});

// Exchange authorization code for access token
router.post('/token', async (req, res) => {
  try {
    const { code } = req.body;
    const redirect_uri = process.env.GOOGLE_REDIRECT_URI!;

    console.log('Token exchange request received:', { 
      code: code ? 'present' : 'missing', 
      redirect_uri
    });

    if (error) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_code`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return res.redirect(`${frontendUrl}/auth/callback?error=token_exchange_failed`);
    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri
    });

    console.log('Token exchange successful');
    res.json({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expiry_date
    });
  } catch (error: any) {
    console.error('Token exchange error:', error);
    const errorMessage = error?.message || 'Unknown error';
    const errorDetails = error?.response?.data || errorMessage;
    
    let userFriendlyError = 'Failed to exchange authorization code';
    if (errorMessage.includes('unauthorized_client')) {
      userFriendlyError = 'Redirect URI mismatch. Please check your Google Cloud Console configuration.';
    } else if (errorMessage.includes('invalid_grant')) {
      userFriendlyError = 'Authorization code expired or already used. Please try logging in again.';
    }

    const tokens = await tokenResponse.json();

    // Fetch user profile
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user info');
      return res.redirect(`${frontendUrl}/auth/callback?error=user_info_failed`);
    }

    const userInfo = await userResponse.json();

    // Store user in session (tokens never exposed to frontend)
    if (req.session) {
      req.session.googleUser = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        emailVerified: userInfo.verified_email,
      };
    }

    res.redirect(`${frontendUrl}/auth/callback`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'https://sillobite.in';
    res.redirect(`${frontendUrl}/auth/callback?error=authentication_failed`);
  }
});

// Get current authenticated user from session
router.get('/me', (req, res) => {
  if (!req.session?.googleUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json(req.session.googleUser);
});

// Verify Google ID token
router.post('/verify', async (req, res) => {
  try {
    const { id_token } = req.body;

    if (!id_token) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    
    res.json({
      valid: true,
      user: {
        id: payload?.sub,
        email: payload?.email,
        name: payload?.name,
        picture: payload?.picture
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(400).json({ 
      error: 'Invalid token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  res.json(req.session.googleUser);
});

export default router;
