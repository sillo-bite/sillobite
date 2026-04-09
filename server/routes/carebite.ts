import { Router } from 'express';
import { carebiteController } from '../controllers/carebiteController';

const rt = Router();

rt.post('/menu', carebiteController.getMenu);
rt.post('/create-order', carebiteController.createOrder);

export default rt;
