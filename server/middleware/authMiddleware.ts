import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/schema';

/**
 * Authentication middleware - verifies user is logged in
 * Checks both session-based auth (cookies) and token-based auth (Bearer tokens)
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const sessionUser = (req.session as any)?.user;
  const tokenUser = (req as any).user; // Set by tokenAuthMiddleware if Bearer token was provided

  if (!sessionUser && !tokenUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Attach user to request for downstream middleware/handlers
  (req as any).user = sessionUser || tokenUser;
  next();
};

/**
 * Admin-only middleware - requires SUPER_ADMIN or ADMIN role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRole = String(user.role).toUpperCase();
  if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

/**
 * Super Admin-only middleware - requires SUPER_ADMIN role
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRole = String(user.role).toUpperCase();
  if (userRole !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  next();
};

/**
 * Role-based middleware - requires specific role(s)
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = String(user.role).toUpperCase();
    const normalizedAllowedRoles = allowedRoles.map(r => String(r).toUpperCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: user.role
      });
    }

    next();
  };
};

/**
 * User ownership middleware - ensures user can only access their own resources
 * Checks if the userId in the route params matches the authenticated user's ID
 * Admins can access any user's resources
 */
export const requireOwnershipOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRole = String(user.role).toUpperCase();
  const requestedUserId = parseInt(req.params.userId || req.params.id);

  // Admins can access any user's resources
  if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
    return next();
  }

  // Regular users can only access their own resources
  if (user.id !== requestedUserId) {
    return res.status(403).json({ error: 'Access denied. You can only access your own resources.' });
  }

  next();
};

/**
 * Legacy middleware for backward compatibility
 * @deprecated Use requireAuth instead
 */
export const mockAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const usr = (req.session as any)?.user;
  if (usr) {
    (req as any).user = usr;
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

/**
 * Token-based authentication middleware
 * Validates Bearer token from Authorization header
 * Used for API token authentication (e.g., connection codes)
 */
export const tokenAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const tk = req.headers.authorization?.replace('Bearer ', '');
  if (!tk) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const { connectionCodeService } = await import('../services/connectionCodeService');
    const uid = await connectionCodeService.validateToken(tk);
    if (!uid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { storage } = await import('../storage-hybrid');
    const usr = await storage.getUser(uid);
    if (!usr) {
      return res.status(401).json({ error: 'User not found' });
    }

    (req as any).user = usr;
    next();
  } catch (err) {
    console.error('Token auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Flexible auth middleware - accepts both session and token
 * Try token first, then fall back to session
 */
export const flexibleAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Check for Bearer token first
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    // Try token authentication
    try {
      const { connectionCodeService } = await import('../services/connectionCodeService');
      const uid = await connectionCodeService.validateToken(token);
      
      if (uid) {
        const { storage } = await import('../storage-hybrid');
        const usr = await storage.getUser(uid);
        
        if (usr) {
          (req as any).user = usr;
          return next();
        }
      }
    } catch (err) {
      console.error('Token auth failed, trying session:', err);
    }
  }

  // Fall back to session authentication
  const sessionUser = (req.session as any)?.user;
  if (sessionUser) {
    (req as any).user = sessionUser;
    return next();
  }

  // No valid authentication found
  return res.status(401).json({ error: 'Authentication required' });
};
