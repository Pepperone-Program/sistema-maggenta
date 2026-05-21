import { Router } from 'express';
import { BannerController } from '@controllers/BannerController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { bannerSchema } from '@utils/validation';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Apenas imagens sao permitidas'));
  },
});
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

router.post(
  '/responsive',
  authMiddleware,
  upload.fields([
    { name: 'desktop', maxCount: 1 },
    { name: 'mobile', maxCount: 1 },
  ]),
  BannerController.createResponsive
);

router.get(
  '/',
  BannerController.list
);

router.get(
  '/ativos',
  
  BannerController.listActive
);

router.put(
  '/reorder',
  authMiddleware,
  BannerController.reorder
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
