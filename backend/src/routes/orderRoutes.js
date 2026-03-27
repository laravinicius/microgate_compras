import { Router } from 'express';

import {
  createOrderHandler,
  deleteOrderHandler,
  getOrderDetailsHandler,
  listOrdersHandler,
  updateOrderHandler
} from '../controllers/orderController.js';
import { requireAdmin, requireAuth } from '../middlewares/authMiddleware.js';

const orderRouter = Router();

orderRouter.get('/orders', requireAuth, listOrdersHandler);
orderRouter.get('/orders/:id', requireAuth, getOrderDetailsHandler);
orderRouter.post('/orders', requireAuth, createOrderHandler);
orderRouter.put('/orders/:id', requireAuth, updateOrderHandler);
orderRouter.delete('/orders/:id', requireAuth, requireAdmin, deleteOrderHandler);

export { orderRouter };
