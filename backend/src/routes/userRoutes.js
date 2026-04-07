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
userRouter.use(requireAdmin);
userRouter.post('/users', createUserHandler);
userRouter.put('/users/:id', updateUserHandler);
userRouter.delete('/users/:id', deleteUserHandler);

export { userRouter };
