import { Router } from 'express';
import { OrcamentoController } from '@controllers/OrcamentoController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { orcamentoSchema, orcamentoItemSchema } from '@utils/validation';

const router = Router();

router.post(
  '/',
  validationMiddleware(orcamentoSchema),
  OrcamentoController.create
);

router.get(
  '/:id',
  authMiddleware,
  OrcamentoController.getById
);

router.get(
  '/',
  authMiddleware,
  OrcamentoController.list
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(orcamentoSchema.fork(
    Object.keys(orcamentoSchema.describe().keys),
    (schema) => schema.optional()
  )),
  OrcamentoController.update
);

router.delete(
  '/:id',
  authMiddleware,
  OrcamentoController.delete
);

router.post(
  '/:id/itens',
  validationMiddleware(orcamentoItemSchema),
  OrcamentoController.addItem
);

router.delete(
  '/itens/:itemId',
  authMiddleware,
  OrcamentoController.removeItem
);

export default router;
