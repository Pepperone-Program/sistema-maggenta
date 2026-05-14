import { Router } from 'express';
import { ClienteController } from '@controllers/ClienteController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { clienteContatoSchema, clienteSchema } from '@utils/validation';

const router = Router();
const updateClienteSchema = clienteSchema.fork(
  Object.keys(clienteSchema.describe().keys),
  (schema) => schema.optional()
);
const updateClienteContatoSchema = clienteContatoSchema.fork(
  Object.keys(clienteContatoSchema.describe().keys),
  (schema) => schema.optional()
);

router.post(
  '/',
  authMiddleware,
  validationMiddleware(clienteSchema),
  ClienteController.create
);

router.get(
  '/',
  authMiddleware,
  ClienteController.list
);

router.post(
  '/:id/contatos',
  authMiddleware,
  validationMiddleware(clienteContatoSchema),
  ClienteController.createContato
);

router.get(
  '/:id/contatos',
  authMiddleware,
  ClienteController.listContatos
);

router.get(
  '/:id/orcamentos',
  authMiddleware,
  ClienteController.listOrcamentos
);

router.get(
  '/:id/contatos/:email',
  authMiddleware,
  ClienteController.getContato
);

router.put(
  '/:id/contatos/:email',
  authMiddleware,
  validationMiddleware(updateClienteContatoSchema),
  ClienteController.updateContato
);

router.delete(
  '/:id/contatos/:email',
  authMiddleware,
  ClienteController.deleteContato
);

router.get(
  '/:id',
  authMiddleware,
  ClienteController.getById
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateClienteSchema),
  ClienteController.update
);

router.delete(
  '/:id',
  authMiddleware,
  ClienteController.delete
);

export default router;
