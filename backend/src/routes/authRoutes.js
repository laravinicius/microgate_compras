import { Router } from 'express';

import { getCurrentUser, login } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const authRouter = Router();

authRouter.post('/auth/login', login);
authRouter.get('/auth/me', requireAuth, getCurrentUser);

export { authRouter };
