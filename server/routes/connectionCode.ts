import { Router } from 'express';
import { connectionCodeController } from '../controllers/connectionCodeController';
import { mockAuthMiddleware } from '../middleware/authMiddleware';

const rt = Router();

rt.post('/generate-code', mockAuthMiddleware, connectionCodeController.generateCode);
rt.post('/verify-code', connectionCodeController.verifyCode);

export default rt;
