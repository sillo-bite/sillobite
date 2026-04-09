import { Request, Response } from 'express';
import { carebiteService } from '../services/carebiteService';

export const carebiteController = {
  async getMenu(req: Request, res: Response) {
    try {
      console.log('🍽️ CareBite menu request received');
      console.log('Body:', req.body);
      
      const { email, accessToken } = req.body;

      if (!email || !accessToken) {
        console.log('❌ Missing email or accessToken');
        return res.status(400).json({ error: 'Email and accessToken are required' });
      }

      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Token: ${accessToken.substring(0, 10)}...`);

      const result = await carebiteService.getMenuForUser(email, accessToken);

      if (!result.success) {
        console.log('❌ Service error:', result.error);
        return res.status(401).json({ error: result.error });
      }

      console.log('✅ Menu fetched successfully');
      console.log(`📊 Canteens: ${result.data?.canteens.length}, Items: ${result.data?.menuItems.length}`);
      
      res.json(result.data);
    } catch (err) {
      console.error('❌ CareBite menu error:', err);
      res.status(500).json({ error: 'Failed to fetch menu' });
    }
  }
};
