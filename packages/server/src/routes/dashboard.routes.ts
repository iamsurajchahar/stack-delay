import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/summary', authenticate, dashboardController.getSummary);
router.get('/trends', authenticate, dashboardController.getTrends);

export default router;
