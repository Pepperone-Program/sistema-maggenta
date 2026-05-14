import { Router } from 'express';
import { SubcategoriaController } from '@controllers/CategoriaController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { subcategoriaSchema, vincularProdutoSchema } from '@utils/validation';

const router = Router();
const updateSubcategoriaSchema = subcategoriaSchema.fork(
  Object.keys(subcategoriaSchema.describe().keys),
  (schema) => schema.optional()
);

router.post(
  '/',
  authMiddleware,
  validationMiddleware(subcategoriaSchema),
  SubcategoriaController.create
);

router.get(
  '/',
  SubcategoriaController.list
);

router.get(
  '/:id/produtos',
  SubcategoriaController.listProdutos
);

router.post(
  '/:id/produtos',
  authMiddleware,
  validationMiddleware(vincularProdutoSchema),
  SubcategoriaController.vincularProduto
);

router.delete(
  '/:id/produtos/:produtoId',
  authMiddleware,
  SubcategoriaController.desvincularProduto
);

router.get(
  '/:id',
  SubcategoriaController.getById
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateSubcategoriaSchema),
  SubcategoriaController.update
);

router.delete(
  '/:id',
  authMiddleware,
  SubcategoriaController.delete
);

export default router;
