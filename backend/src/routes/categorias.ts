import { Router } from 'express';
import { CategoriaController } from '@controllers/CategoriaController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { categoriaSchema, vincularProdutoSchema } from '@utils/validation';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Apenas imagens sao permitidas'));
  },
});
const updateCategoriaSchema = categoriaSchema.fork(
  Object.keys(categoriaSchema.describe().keys),
  (schema) => schema.optional()
);

router.post(
  '/',
  authMiddleware,
  validationMiddleware(categoriaSchema),
  CategoriaController.create
);

router.get(
  '/',
  CategoriaController.list
);

router.get(
  '/:id/subcategorias',
  CategoriaController.listSubcategorias
);

router.get(
  '/:id/catalogo',
  CategoriaController.catalogo
);

router.post(
  '/:id/capa',
  upload.single('image'),
  CategoriaController.uploadCapa
);

router.get(
  '/:id/produtos',
  CategoriaController.listProdutos
);

router.post(
  '/:id/produtos',
  authMiddleware,
  validationMiddleware(vincularProdutoSchema),
  CategoriaController.vincularProduto
);

router.delete(
  '/:id/produtos/:produtoId',
  authMiddleware,
  CategoriaController.desvincularProduto
);

router.get(
  '/:id',
  CategoriaController.getById
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateCategoriaSchema),
  CategoriaController.update
);

router.delete(
  '/:id',
  authMiddleware,
  CategoriaController.delete
);

export default router;
