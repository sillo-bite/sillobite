/**
 * Google OAuth 2.0 Server Routes
 * Handles token exchange and user info retrieval
 */

import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';

const router = Router();

// Initialize Google OAuth client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Exchange authorization code for access token
router.post('/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    console.log('Token exchange request received:', { code: code ? 'present' : 'missing', redirect_uri });

    if (!code) {
      console.error('No authorization code provided');
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log('Exchanging code for tokens...');
    // Exchange code for tokens
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
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(400).json({ 
      error: 'Failed to exchange authorization code',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user info from Google
router.post('/user', async (req, res) => {
  try {
    const { access_token, id_token } = req.body;
    console.log('User info request received:', { 
      access_token: access_token ? 'present' : 'missing', 
      id_token: id_token ? 'present' : 'missing' 
    });

    if (!access_token && !id_token) {
      console.error('No tokens provided for user info request');
      return res.status(400).json({ error: 'Access token or ID token is required' });
    }

    let userInfo;

    if (id_token) {
      console.log('Verifying ID token...');
      // Verify and decode ID token
      const ticket = await oauth2Client.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      
      userInfo = ticket.getPayload();
      console.log('ID token verified, user info:', { id: userInfo?.sub, email: userInfo?.email });
    } else if (access_token) {
      console.log('Fetching user info from Google API...');
      // Get user info from Google API
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info from Google');
      }

      userInfo = await response.json();
      console.log('User info fetched from Google API:', { id: userInfo.id, email: userInfo.email });
    }

    if (!userInfo) {
      console.error('No user info received');
      return res.status(400).json({ error: 'Failed to get user info' });
    }

    const responseData = {
      id: userInfo.sub || userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      verified_email: userInfo.email_verified
    };

    console.log('Returning user info:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('User info error:', error);
    res.status(400).json({ 
      error: 'Failed to get user info',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
