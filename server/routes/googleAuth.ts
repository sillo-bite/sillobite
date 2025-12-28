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
    const frontendUrl = process.env.FRONTEND_URL || 'https://sillobite.in';

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

export default router;
