import { Router } from 'express';
import { carebiteController } from '../controllers/carebiteController';
import { requireAdmin } from '../middleware/authMiddleware';

const rt = Router();

rt.post('/menu', requireAdmin, carebiteController.getMenu);

export default rt;
