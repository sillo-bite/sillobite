/**
 * Google OAuth 2.0 Server Routes
 * Handles token exchange and user info retrieval
 */

import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { storage } from '../storage-hybrid';
import crypto from 'crypto';

const router = Router();

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


// Initiate Google OAuth flow
router.get('/', (req, res) => {
  // ── SECURITY FIX (Problem 3): OAuth CSRF protection via state parameter ──
  // Without a state nonce, an attacker can trick a victim into completing an
  // OAuth flow with the attacker's Google account (OAuth login CSRF).
  // We generate a random nonce, store it in the server session, and pass it
  // to Google. On callback we verify the returned state matches what we stored.
  const oauthState = crypto.randomBytes(16).toString('hex');
  (req.session as any).oauthState = oauthState;

  // Save session before redirecting so the nonce is persisted
  req.session.save((err) => {
    if (err) {
      console.error('Failed to save OAuth state to session:', err);
      return res.status(500).json({ error: 'Failed to initiate OAuth flow' });
    }

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state: oauthState,   // ← CSRF nonce sent to Google, returned on callback
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });
});

// Handle Google OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, error, state } = req.query;

    if (error) {
      console.error('OAuth error:', error);
      return res.redirect(`/auth/callback?error=${encodeURIComponent(error as string)}`);
    }

    // ── SECURITY FIX (Problem 3): Verify CSRF state nonce ──────────────────
    // If state is missing or doesn't match what we stored in the session,
    // this could be a CSRF attack — reject immediately.
    const sessionState = (req.session as any).oauthState;

    if (!state || !sessionState) {
      console.error('OAuth CSRF check failed: state or session oauthState missing');
      return res.redirect('/auth/callback?error=missing_state');
    }

    // Use timing-safe comparison to prevent timing side-channel attacks
    const stateBuffer   = Buffer.from(String(state));
    const sessionBuffer = Buffer.from(String(sessionState));
    const stateMatches  =
      stateBuffer.length === sessionBuffer.length &&
      crypto.timingSafeEqual(stateBuffer, sessionBuffer);

    if (!stateMatches) {
      console.error('OAuth CSRF check failed: state mismatch — possible CSRF attack');
      return res.redirect('/auth/callback?error=state_mismatch');
    }

    // Nonce is valid — delete it from session so it cannot be replayed
    delete (req.session as any).oauthState;
    // ────────────────────────────────────────────────────────────────────────

    if (!code || typeof code !== 'string') {
      console.error('No authorization code provided');
      return res.redirect(`/auth/callback?error=no_code`);
    }

    console.log('OAuth callback - exchanging code for tokens');

    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!
    });

    if (!tokens.id_token) {
      console.error('No ID token received');
      return res.redirect(`/auth/callback?error=no_id_token`);
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload) {
      console.error('No payload in ID token');
      return res.redirect(`/auth/callback?error=invalid_token`);
    }

    const userData = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified
    };

    console.log('User authenticated:', { email: userData.email });

    // Fetch user from database to get complete user data including role
    let dbUser = null;
    try {
      dbUser = await storage.getUserByEmail(userData.email || '');
    } catch (dbError) {
      console.error('Error fetching user from database:', dbError);
    }

    // Merge Google user data with database user data
    const completeUserData = {
      ...userData,
      ...(dbUser && {
        id: dbUser.id,
        role: dbUser.role ? String(dbUser.role).toLowerCase() : undefined,
        phoneNumber: dbUser.phoneNumber,
        registerNumber: dbUser.registerNumber,
        department: dbUser.department,
        college: dbUser.college,
        staffId: dbUser.staffId,
        isProfileComplete: dbUser.isProfileComplete
      })
    };

    // SECURITY: Set session ONLY — do NOT pass user data in redirect URL params.
    // Passing email/name/id in the URL allows anyone to forge identity by
    // crafting /auth/callback?email=admin@example.com — identity must come
    // exclusively from the server-side session via GET /api/auth/session.
    if (req.session) {
      (req.session as any).user = completeUserData;
      (req.session as any).googleUser = userData;
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/auth/callback?error=session_save_failed');
        }
        // Redirect with only a success flag — zero user data in URL
        res.redirect('/auth/callback?status=success');
      });
    } else {
      res.redirect('/auth/callback?error=no_session');
    }
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const errorMessage = error?.message || 'authentication_failed';
    res.redirect(`/auth/callback?error=${encodeURIComponent(errorMessage)}`);
  }
});

// Exchange authorization code for access token
// SECURITY FIX (Problem 4): This endpoint no longer returns raw tokens to the
// browser. Tokens (access_token, id_token, refresh_token) are kept server-side
// only. The client receives only { success: true } and the identity is set in
// the server-side session, the same way the redirect callback works.
router.post('/token', async (req, res) => {
  try {
    const { code } = req.body;
    const redirect_uri = process.env.GOOGLE_REDIRECT_URI!;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for tokens — kept entirely server-side
    const { tokens } = await oauth2Client.getToken({ code, redirect_uri });

    if (!tokens.id_token) {
      return res.status(400).json({ error: 'No ID token received from Google' });
    }

    // Cryptographically verify the ID token
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ error: 'Invalid ID token payload' });
    }

    const userData = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified,
    };

    // Fetch role and profile from our DB
    let dbUser = null;
    try {
      dbUser = await storage.getUserByEmail(userData.email || '');
    } catch (dbError) {
      console.error('Error fetching user from database:', dbError);
    }

    const completeUserData = {
      ...userData,
      ...(dbUser && {
        id: dbUser.id,
        role: dbUser.role ? String(dbUser.role).toLowerCase() : undefined,
        phoneNumber: dbUser.phoneNumber,
        registerNumber: dbUser.registerNumber,
        department: dbUser.department,
        college: dbUser.college,
        staffId: dbUser.staffId,
        isProfileComplete: dbUser.isProfileComplete,
      }),
    };

    // Set session server-side — tokens never leave the server
    (req.session as any).user = completeUserData;
    (req.session as any).googleUser = userData;

    // Return only success — no tokens, no user data in response body
    res.json({ success: true });
  } catch (error: any) {
    console.error('Token exchange error:', error);
    const errorMessage = error?.message || 'Unknown error';

    let userFriendlyError = 'Failed to exchange authorization code';
    if (errorMessage.includes('unauthorized_client')) {
      userFriendlyError = 'Redirect URI mismatch. Please check your Google Cloud Console configuration.';
    } else if (errorMessage.includes('invalid_grant')) {
      userFriendlyError = 'Authorization code expired or already used. Please try logging in again.';
    }

    res.status(400).json({ error: userFriendlyError });
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
});

export default router;
