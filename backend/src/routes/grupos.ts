import { Router } from 'express';
import { GrupoPermissaoController } from '@controllers/GrupoPermissaoController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { grupoPermissaoSchema, grupoUsuarioSchema } from '@utils/validation';

const router = Router();

router.get(
  '/',
  authMiddleware,
  GrupoPermissaoController.listGrupos
);

router.get(
  '/usuarios',
  authMiddleware,
  GrupoPermissaoController.listUsuariosComGrupos
);

router.get(
  '/usuarios/:usuarioId/grupos',
  authMiddleware,
  GrupoPermissaoController.listGruposByUsuario
);

router.put(
  '/usuarios/:usuarioId/grupo',
  authMiddleware,
  GrupoPermissaoController.setUsuarioGrupo
);

router.get(
  '/usuarios/:usuarioId/permissoes',
  authMiddleware,
  GrupoPermissaoController.listPermissoesByUsuario
);

router.get(
  '/:grupo/permissoes',
  authMiddleware,
  GrupoPermissaoController.listPermissoes
);

router.post(
  '/:grupo/permissoes',
  authMiddleware,
  validationMiddleware(grupoPermissaoSchema),
  GrupoPermissaoController.addPermissao
);

router.delete(
  '/:grupo/permissoes/:permissao',
  authMiddleware,
  GrupoPermissaoController.removePermissao
);

router.get(
  '/:grupo/usuarios',
  authMiddleware,
  GrupoPermissaoController.listUsuarios
);

router.post(
  '/:grupo/usuarios',
  authMiddleware,
  validationMiddleware(grupoUsuarioSchema),
  GrupoPermissaoController.addUsuario
);

router.delete(
  '/:grupo/usuarios/:usuarioId',
  authMiddleware,
  GrupoPermissaoController.removeUsuario
);

export default router;
