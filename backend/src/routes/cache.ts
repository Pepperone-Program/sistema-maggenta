import { Router } from 'express';
import { CacheController } from '@controllers/CacheController';
import { authMiddleware } from '@middleware/auth';

const router = Router();

router.post('/invalidate/all', CacheController.invalidateAll);
router.post('/invalidate/:namespace', CacheController.invalidate);
router.post('/invalidate', authMiddleware, CacheController.invalidate);

export default router;
