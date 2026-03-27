import { Router } from 'express';

import { createOrderHandler } from '../controllers/orderController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const orderRouter = Router();

orderRouter.post('/orders', requireAuth, createOrderHandler);

export { orderRouter };
