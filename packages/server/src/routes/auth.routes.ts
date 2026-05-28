import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.get('/github', authLimiter, authController.githubRedirect);
router.get('/github/callback', authLimiter, authController.githubCallback);
router.post('/refresh', authLimiter, authController.refreshToken);
router.delete('/session', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;
