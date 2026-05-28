import { Router } from 'express';
import * as scoresController from '../controllers/scores.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.get('/current', authenticate, scoresController.getCurrent);
router.get('/history', authenticate, scoresController.getHistory);
router.get('/dependencies', authenticate, scoresController.getDependencyScores);

export default router;
