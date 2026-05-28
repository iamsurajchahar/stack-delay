import { Router } from 'express';
import * as dependenciesController from '../controllers/dependencies.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/:ecosystem/:name', authenticate, dependenciesController.getPackage);
router.get('/:ecosystem/:name/health-history', authenticate, dependenciesController.getHealthHistory);
router.get('/:ecosystem/:name/vulnerabilities', authenticate, dependenciesController.getVulnerabilities);

export default router;
