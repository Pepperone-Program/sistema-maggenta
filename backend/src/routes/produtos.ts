import { Router } from 'express';
import { ProdutoController } from '@controllers/ProdutoController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { productSchema } from '@utils/validation';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 8,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Apenas imagens sao permitidas'));
  },
});

router.post(
  '/',
  validationMiddleware(productSchema),
  ProdutoController.create
);

router.get(
  '/:id/images',
  ProdutoController.listImages
);

router.get(
  '/:id/links',
  ProdutoController.listLinks
);

router.post(
  '/:id/images',
  authMiddleware,
  upload.array('images', 8),
  ProdutoController.uploadImages
);

router.put(
  '/:id/images/reorder',
  authMiddleware,
  ProdutoController.reorderImages
);

router.get(
  '/:id/images/:filename/view',
  authMiddleware,
  ProdutoController.viewImage
);

router.delete(
  '/:id/images/:filename',
  authMiddleware,
  ProdutoController.removeImage
);

router.get(
  '/site/busca',
  ProdutoController.searchSite
);

router.get(
  '/site',
  ProdutoController.listSite
);

router.get(
  '/:id',
  ProdutoController.getById
);

router.get(
  '/',
  ProdutoController.list
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(productSchema.fork(
    Object.keys(productSchema.describe().keys),
    (schema) => schema.optional()
  )),
  ProdutoController.update
);

router.delete(
  '/:id',
  authMiddleware,
  ProdutoController.delete
);

export default router;
