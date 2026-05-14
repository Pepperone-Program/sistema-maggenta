import { Router } from 'express';
import { DataPromocionalController } from '@controllers/DataPromocionalController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { dataPromocionalSchema, vincularProdutoSchema } from '@utils/validation';

const router = Router();
const updateDataPromocionalSchema = dataPromocionalSchema.fork(
  Object.keys(dataPromocionalSchema.describe().keys),
  (schema) => schema.optional()
);

router.post(
  '/',
  authMiddleware,
  validationMiddleware(dataPromocionalSchema),
  DataPromocionalController.create
);

router.get(
  '/',
  DataPromocionalController.list
);

router.get(
  '/:id/produtos',
  DataPromocionalController.listProdutos
);

router.get(
  '/:id/catalogo',
  DataPromocionalController.catalogo
);

router.post(
  '/:id/produtos',
  authMiddleware,
  validationMiddleware(vincularProdutoSchema),
  DataPromocionalController.vincularProduto
);

router.delete(
  '/:id/produtos/:produtoId',
  DataPromocionalController.desvincularProduto
);

router.get(
  '/:id',
  DataPromocionalController.getById
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateDataPromocionalSchema),
  DataPromocionalController.update
);

router.delete(
  '/:id',
  authMiddleware,
  DataPromocionalController.delete
);

export default router;
