import { Router } from 'express';

import {
  createUserHandler,
  deleteUserHandler,
  getUsers,
  updateUserHandler
} from '../controllers/userController.js';
import { requireAdmin, requireAuth } from '../middlewares/authMiddleware.js';

const userRouter = Router();

userRouter.use(requireAuth, requireAdmin);
userRouter.get('/users', getUsers);
userRouter.post('/users', createUserHandler);
userRouter.put('/users/:id', updateUserHandler);
userRouter.delete('/users/:id', deleteUserHandler);

export { userRouter };
