import { Router } from 'express';
import { SearchController } from '@controllers/SearchController';
import { authMiddleware, optionalAuthMiddleware } from '@middleware/auth';
import { requireSearchPermission } from '@middleware/searchPermission';

const router = Router();

router.get('/autocomplete', optionalAuthMiddleware, SearchController.autocomplete);
router.post('/click', optionalAuthMiddleware, SearchController.click);
router.get('/debug', authMiddleware, requireSearchPermission('search.debug'), SearchController.debug);
router.get('/debug/results', authMiddleware, requireSearchPermission('search.debug'), SearchController.forcedSearch);
router.get('/products/:id/metadata', authMiddleware, requireSearchPermission('search.manage'), SearchController.getMetadata);
router.put('/products/:id/metadata', authMiddleware, requireSearchPermission('search.manage'), SearchController.putMetadata);
router.get('/:entity', authMiddleware, requireSearchPermission('search.manage'), SearchController.list);
router.post('/:entity', authMiddleware, requireSearchPermission('search.manage'), SearchController.create);
router.put('/:entity/:id', authMiddleware, requireSearchPermission('search.manage'), SearchController.update);
router.delete('/:entity/:id', authMiddleware, requireSearchPermission('search.manage'), SearchController.remove);

export default router;
