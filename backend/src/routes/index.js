import { Router } from 'express';

import { authRouter } from './authRoutes.js';
import { healthRouter } from './healthRoutes.js';
import { orderRouter } from './orderRoutes.js';
import { userRouter } from './userRoutes.js';

const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use(healthRouter);
apiRouter.use(orderRouter);
apiRouter.use(userRouter);

export { apiRouter };
