import { Router } from 'express';
import { SubcategoriaController } from '@controllers/CategoriaController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { subcategoriaSchema, vincularProdutoSchema, vincularProdutosLoteSchema } from '@utils/validation';

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

router.get(
  '/:id/produtos/disponiveis',
  authMiddleware,
  SubcategoriaController.listProdutosDisponiveis
);

router.post(
  '/:id/produtos/lote',
  authMiddleware,
  validationMiddleware(vincularProdutosLoteSchema),
  SubcategoriaController.vincularProdutosLote
);

router.delete(
  '/:id/produtos',
  authMiddleware,
  SubcategoriaController.desvincularProdutosLote
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
