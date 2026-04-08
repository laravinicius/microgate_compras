import { Router } from 'express';

import {
  createUserHandler,
  deleteUserHandler,
  getUsers,
  updateUserHandler
} from '../controllers/userController.js';
import {
  requireAdmin,
  requireAuth,
  requirePasswordChangeComplete
} from '../middlewares/authMiddleware.js';

const userRouter = Router();

userRouter.use(requireAuth, requirePasswordChangeComplete);
userRouter.get('/users', getUsers);
userRouter.post('/users', requireAdmin, createUserHandler);
userRouter.put('/users/:id', requireAdmin, updateUserHandler);
userRouter.delete('/users/:id', requireAdmin, deleteUserHandler);

export { userRouter };
