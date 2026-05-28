import { Router } from 'express';
import * as scansController from '../controllers/scans.controller';
import { authenticate } from '../middleware/auth.middleware';
import { scanLimiter } from '../middleware/rateLimiter.middleware';

const router = Router({ mergeParams: true });

router.post('/', authenticate, scanLimiter, scansController.trigger);
router.get('/', authenticate, scansController.list);
router.get('/latest', authenticate, scansController.getLatest);
router.get('/:scanId', authenticate, scansController.getById);

export default router;
