import { Router } from 'express';
import * as recommendationsController from '../controllers/recommendations.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.get('/', authenticate, recommendationsController.list);

export default router;
