import { Router } from 'express';
import { LandingPageController } from '@controllers/LandingPageController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { landingPageSchema } from '@utils/validation';

const router = Router();
const updateSchema = landingPageSchema.fork(
  Object.keys(landingPageSchema.describe().keys),
  (schema) => schema.optional()
).min(1);

router.get('/', LandingPageController.list);
router.get('/:id', LandingPageController.getById);
router.post('/', authMiddleware, validationMiddleware(landingPageSchema), LandingPageController.create);
router.put('/:id', authMiddleware, validationMiddleware(updateSchema), LandingPageController.update);
router.delete('/:id', authMiddleware, LandingPageController.delete);

export default router;
