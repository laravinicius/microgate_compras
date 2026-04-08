import { Router } from 'express';

import {
  createOrderHandler,
  deleteOrderHandler,
  getOrderDetailsHandler,
  listOrdersHandler,
  reopenOrderHandler,
  updateOrderHandler
} from '../controllers/orderController.js';
import {
  requireAdmin,
  requireAuth,
  requirePasswordChangeComplete
} from '../middlewares/authMiddleware.js';

const orderRouter = Router();

orderRouter.use(requireAuth, requirePasswordChangeComplete);
orderRouter.get('/orders', listOrdersHandler);
orderRouter.get('/orders/:id', getOrderDetailsHandler);
orderRouter.post('/orders', createOrderHandler);
orderRouter.put('/orders/:id', updateOrderHandler);
orderRouter.put('/orders/:id/reopen', reopenOrderHandler);
orderRouter.delete('/orders/:id', deleteOrderHandler);

export { orderRouter };
