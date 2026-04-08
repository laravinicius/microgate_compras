import { Router } from 'express';

import {
  createOrderHandler,
  deleteOrderHandler,
  getOrderItemImageHandler,
  getOrderDetailsHandler,
  listOrdersHandler,
  reopenOrderHandler,
  updateOrderHandler
} from '../controllers/orderController.js';
import { createOrderUploadMiddleware } from '../middlewares/orderImageUploadMiddleware.js';
import {
  requireAdmin,
  requireAuth,
  requirePasswordChangeComplete
} from '../middlewares/authMiddleware.js';

const orderRouter = Router();

orderRouter.use(requireAuth, requirePasswordChangeComplete);
orderRouter.get('/orders', listOrdersHandler);
orderRouter.get('/orders/:id', getOrderDetailsHandler);
orderRouter.get('/orders/:id/items/:itemId/image', getOrderItemImageHandler);
orderRouter.post('/orders', createOrderUploadMiddleware, createOrderHandler);
orderRouter.put('/orders/:id', updateOrderHandler);
orderRouter.put('/orders/:id/reopen', reopenOrderHandler);
orderRouter.delete('/orders/:id', deleteOrderHandler);

export { orderRouter };
