import { Router } from 'express';
import { BannerController } from '@controllers/BannerController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { bannerSchema } from '@utils/validation';

const router = Router();
const updateBannerSchema = bannerSchema.fork(
  Object.keys(bannerSchema.describe().keys),
  (schema) => schema.optional()
);

router.post(
  '/',
  authMiddleware,
  validationMiddleware(bannerSchema),
  BannerController.create
);

router.get(
  '/',
  authMiddleware,
  BannerController.list
);

router.get(
  '/ativos',
  
  BannerController.listActive
);

router.get(
  '/:id',
  authMiddleware,
  BannerController.getById
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateBannerSchema),
  BannerController.update
);

router.delete(
  '/:id',
  authMiddleware,
  BannerController.delete
);

export default router;
