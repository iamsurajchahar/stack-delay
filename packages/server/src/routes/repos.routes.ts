import { Router } from 'express';
import * as reposController from '../controllers/repos.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, reposController.list);
router.get('/available', authenticate, reposController.listAvailable);
router.post('/', authenticate, reposController.create);
router.get('/:repoId', authenticate, reposController.getById);
router.patch('/:repoId', authenticate, reposController.update);
router.delete('/:repoId', authenticate, reposController.remove);

export default router;
