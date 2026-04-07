import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { changePassword, getCurrentUser, login } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const authRouter = Router();

const loginRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 8,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		error: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
	}
});

authRouter.post('/auth/login', loginRateLimit, login);
authRouter.get('/auth/me', requireAuth, getCurrentUser);
authRouter.put('/auth/password', requireAuth, changePassword);

export { authRouter };
