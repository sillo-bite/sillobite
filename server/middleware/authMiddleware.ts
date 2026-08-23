import { Request, Response, NextFunction } from 'express';

// ─── Role verification cache ──────────────────────────────────────────────────
// Caches the live DB role for each session for 30 seconds so we don't hit the
// DB on every single request, while still detecting role revocations quickly.
interface RoleCacheEntry {
  role: string;
  expiresAt: number;
}
const roleCache = new Map<string, RoleCacheEntry>();
const ROLE_CACHE_TTL_MS = 30_000; // 30 seconds

// Cleanup stale entries every 5 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(roleCache.entries())) {
    if (now > entry.expiresAt) roleCache.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Fetches the current role for a user from the DB, with a 30-second cache.
 * Falls back to the session role if the DB lookup fails (to avoid locking
 * users out due to a transient DB error).
 */
async function getLiveRole(sessionUserId: number, sessionRole: string): Promise<string> {
  const cacheKey = `role:${sessionUserId}`;
  const cached = roleCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.role;
  }

  try {
    const { storage } = await import('../storage-hybrid');
    const dbUser = await storage.getUser(sessionUserId);

    if (!dbUser) {
      // User no longer exists — return an empty string so role checks fail
      roleCache.set(cacheKey, { role: '', expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
      return '';
    }

    const liveRole = String(dbUser.role ?? '').toLowerCase();
    roleCache.set(cacheKey, { role: liveRole, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
    return liveRole;
  } catch (err) {
    // DB error — fall back to session role so we don't break the app
    console.error('[authMiddleware] DB role verification failed, falling back to session role:', err);
    return sessionRole;
  }
}

// ─── Session-based middleware (used by most routes) ───────────────────────────

/** Requires any authenticated session user. */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  (req as any).user = user;
  next();
};

/**
 * Requires admin or super_admin role.
 * Verifies the role from the DB (30-second cache) to catch stale sessions
 * where a role was changed or revoked after login.
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const sessionRole = String(user.role ?? '').toLowerCase();
  const liveRole = await getLiveRole(user.id, sessionRole);

  if (liveRole !== 'admin' && liveRole !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Refresh session role if it drifted from DB
  if (liveRole !== sessionRole) {
    (req.session as any).user = { ...user, role: liveRole };
  }

  (req as any).user = { ...user, role: liveRole };
  next();
};

/**
 * Requires canteen_owner, admin, or super_admin role.
 * Verifies the role from the DB (30-second cache) to catch stale sessions.
 */
export const requireCanteenOwnerOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const sessionRole = String(user.role ?? '').toLowerCase();
  const liveRole = await getLiveRole(user.id, sessionRole);

  const allowed =
    liveRole === 'admin' ||
    liveRole === 'super_admin' ||
    liveRole === 'canteen_owner' ||
    liveRole === 'canteen-owner';

  if (!allowed) {
    return res.status(403).json({ error: 'Canteen owner or admin access required' });
  }

  // Refresh session role if it drifted from DB
  if (liveRole !== sessionRole) {
    (req.session as any).user = { ...user, role: liveRole };
  }

  (req as any).user = { ...user, role: liveRole };
  next();
};

// ─── Cache invalidation helper ────────────────────────────────────────────────

/**
 * Call this whenever a user's role is changed so the next request
 * immediately picks up the new role from DB instead of waiting 30 seconds.
 */
export function invalidateRoleCache(userId: number): void {
  roleCache.delete(`role:${userId}`);
}

// ─── Legacy / token-based middleware (kept for backward compatibility) ─────────

/**
 * @deprecated Use requireAuth instead.
 * Checks session and attaches user — identical to requireAuth but uses old name.
 */
export const mockAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const usr = (req.session as any)?.user;
  if (usr) {
    (req as any).user = usr;
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

/** Bearer-token auth used by the connection-code service. */
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
