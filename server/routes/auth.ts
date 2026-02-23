/**
 * Email/Password Authentication Routes
 * Handles user registration and login with email/password
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { storage } from '../storage-hybrid';
import { insertUserSchema, UserRole } from '@shared/schema';
import { db as getPostgresDb } from '../db';

const router = Router();

// Register new user with email/phone + password
router.post('/register', async (req, res) => {
  try {
    const { email, password, phoneNumber, identifier, name } = req.body;
    const loginIdentifier = (identifier || email || phoneNumber || '').trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = loginIdentifier.includes('@');
    const normalizedPhone = loginIdentifier.replace(/\D/g, '');

    // Validate required fields - need identifier (email or phone) and password
    if (!loginIdentifier || !password) {
      return res.status(400).json({
        error: 'Email/phone and password are required'
      });
    }

    // Validate identifier format
    if (isEmail) {
      if (!emailRegex.test(loginIdentifier)) {
        return res.status(400).json({
          error: 'Invalid email format'
        });
      }
    } else {
      if (!normalizedPhone || normalizedPhone.length < 8) {
        return res.status(400).json({
          error: 'Invalid phone number'
        });
      }
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    // Normalize email value (if not provided and using phone, auto-generate a placeholder)
    const finalEmail = (isEmail ? loginIdentifier.toLowerCase() : (email || `phone+${normalizedPhone}@autogen.local`)).toLowerCase();
    const finalPhone = isEmail ? (phoneNumber ? phoneNumber.replace(/\D/g, '') : undefined) : normalizedPhone;

    // Check if user already exists by email or phone
    const existingEmailUser = await storage.getUserByEmail(finalEmail);
    if (existingEmailUser) {
      return res.status(409).json({
        error: 'Email is already registered'
      });
    }

    if (finalPhone) {
      const existingPhoneUser = await storage.getUserByPhoneNumber(finalPhone);
      if (existingPhoneUser) {
        return res.status(409).json({
          error: 'Phone number is already registered'
        });
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user with minimal data - name will be collected in profile setup
    // Use email/phone username as temporary name
    const tempName = name?.trim() || (isEmail ? finalEmail.split('@')[0] : `user_${finalPhone}`);

    // Prepare user data for validation (phoneNumber optional)
    const userDataForValidation = {
      email: finalEmail,
      ...(finalPhone ? { phoneNumber: finalPhone } : {}),
      name: tempName, // Temporary name, will be updated in profile setup
      role: UserRole.STUDENT, // Default role, will be updated in profile setup
      isProfileComplete: false,
    };

    // Validate user data with schema (phoneNumber is optional, so we omit it)
    const validatedData = insertUserSchema.parse(userDataForValidation);

    // Create user in database with password hash
    const db = getPostgresDb();
    const { role: validatedRole, ...restValidatedData } = validatedData;
    const newUser = await db.user.create({
      data: {
        ...restValidatedData,
        role: validatedRole as string as any,
        passwordHash,
      }
    });

    // Return user data (without password hash)
    const { passwordHash: _, ...userResponse } = newUser;

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error && error.message.includes('zod')) {
      return res.status(400).json({
        error: 'Invalid user data',
        details: error.message
      });
    }
    res.status(500).json({
      error: 'Failed to register user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Login with email/phone and password
router.post('/login', async (req, res) => {
  try {
    const { email, identifier, password } = req.body;
    const loginIdentifier = (identifier || email || '').trim();

    // Validate required fields
    if (!loginIdentifier || !password) {
      return res.status(400).json({
        error: 'Email/phone and password are required'
      });
    }

    // Determine lookup strategy
    let user;
    if (loginIdentifier.includes('@')) {
      // Email-based login
      user = await storage.getUserByEmail(loginIdentifier.toLowerCase());
    } else {
      // Phone-based login
      const normalizedPhone = loginIdentifier.replace(/\D/g, '');
      user = await storage.getUserByPhoneNumber(normalizedPhone || loginIdentifier);
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid login credentials'
      });
    }

    // Check if user has a password (might be Google OAuth only user)
    if (!user.passwordHash) {
      return res.status(401).json({
        error: 'This account uses Google sign-in. Please sign in with Google.'
      });
    }

    // Check if user is blocked
    if (user.role && user.role.startsWith('blocked_')) {
      return res.status(403).json({
        error: 'Your account has been blocked. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid login credentials'
      });
    }

    // Return user data (without password hash)
    const { passwordHash: _, ...userResponse } = user;

    // Set session
    if (req.session) {
      (req.session as any).user = userResponse;
      (req as any).session.save();
    }

    res.json({
      message: 'Login successful',
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Failed to login',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current session user
router.get('/session', (req, res) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user });
});

// Logout
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to logout' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  } else {
    res.json({ message: 'Logged out successfully' });
  }
});

export default router;

