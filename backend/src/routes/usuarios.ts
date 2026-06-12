import { Router } from 'express';
import { UsuarioController } from '@controllers/UsuarioController';
import { authMiddleware, optionalAuthMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { usuarioSchema, loginSchema } from '@utils/validation';

const router = Router();

router.post(
  '/',
  optionalAuthMiddleware,
  validationMiddleware(usuarioSchema),
  UsuarioController.register
);

router.post(
  '/login',
  validationMiddleware(loginSchema),
  UsuarioController.login
);

router.get(
  '/profile',
  authMiddleware,
  UsuarioController.getProfile
);

router.get(
  '/:id',
  authMiddleware,
  UsuarioController.getById
);

router.get(
  '/',
  authMiddleware,
  UsuarioController.list
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(usuarioSchema.fork(
    Object.keys(usuarioSchema.describe().keys),
    (schema) => schema.optional()
  )),
  UsuarioController.update
);

router.delete(
  '/:id',
  authMiddleware,
  UsuarioController.delete
);

export default router;
