import { Request, Response } from 'express';
import { connectionCodeService } from '../services/connectionCodeService';

export const connectionCodeController = {
  async generateCode(req: Request, res: Response) {
    try {
      const usr = (req as any).user;
      if (!usr || !usr.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { code, expiresAt } = await connectionCodeService.createCode(usr.id);

      res.json({
        code,
        expires_at: expiresAt.toISOString()
      });
    } catch (err) {
      console.error('Generate code error:', err);
      res.status(500).json({ error: 'Failed to generate code' });
    }
  },

  async verifyCode(req: Request, res: Response) {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
      }

      const result = await connectionCodeService.verifyCode(email, code.toUpperCase());

      if (!result) {
        return res.status(401).json({ error: 'Invalid or expired code' });
      }

      res.json({
        access_token: result.token,
        user_id: result.userId
      });
    } catch (err) {
      console.error('Verify code error:', err);
      res.status(500).json({ error: 'Failed to verify code' });
    }
  }
};
