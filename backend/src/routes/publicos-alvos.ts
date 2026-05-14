import { Router } from 'express';
import { PublicoAlvoController } from '@controllers/PublicoAlvoController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { publicoAlvoSchema, vincularProdutoSchema } from '@utils/validation';

const router = Router();
const updatePublicoAlvoSchema = publicoAlvoSchema.fork(
  Object.keys(publicoAlvoSchema.describe().keys),
  (schema) => schema.optional()
);

router.post(
  '/',
  authMiddleware,
  validationMiddleware(publicoAlvoSchema),
  PublicoAlvoController.create
);

router.get(
  '/',
  PublicoAlvoController.list
);

router.get(
  '/:id/produtos',
  PublicoAlvoController.listProdutos
);

router.get(
  '/:id/catalogo',
  PublicoAlvoController.catalogo
);

router.post(
  '/:id/produtos',
  authMiddleware,
  validationMiddleware(vincularProdutoSchema),
  PublicoAlvoController.vincularProduto
);

router.delete(
  '/:id/produtos/:produtoId',
  authMiddleware,
  PublicoAlvoController.desvincularProduto
);

router.get(
  '/:id',
  PublicoAlvoController.getById
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updatePublicoAlvoSchema),
  PublicoAlvoController.update
);

router.delete(
  '/:id',
  authMiddleware,
  PublicoAlvoController.delete
);

export default router;
