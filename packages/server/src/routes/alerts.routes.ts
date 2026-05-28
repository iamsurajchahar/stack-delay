import { Router } from 'express';
import * as alertsController from '../controllers/alerts.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/rules', authenticate, alertsController.listRules);
router.post('/rules', authenticate, alertsController.createRule);
router.patch('/rules/:ruleId', authenticate, alertsController.updateRule);
router.delete('/rules/:ruleId', authenticate, alertsController.deleteRule);
router.get('/history', authenticate, alertsController.getHistory);

export default router;
