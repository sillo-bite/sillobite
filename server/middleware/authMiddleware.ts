import { Request, Response, NextFunction } from 'express';

export const mockAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const usr = (req.session as any)?.user;
  if (usr) {
    (req as any).user = usr;
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

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
