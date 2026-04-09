import { Router } from 'express';
import { carebiteController } from '../controllers/carebiteController';

const rt = Router();

rt.post('/menu', carebiteController.getMenu);

export default rt;
