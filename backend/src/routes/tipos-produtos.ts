import { Router } from 'express';
import { TipoProdutoController } from '@controllers/TipoProdutoController';

const router = Router();

router.get(
  '/',
  TipoProdutoController.list
);

router.get(
  '/habilitados',
  TipoProdutoController.listHabilitados
);

router.get(
  '/:id/catalogo',
  TipoProdutoController.catalogo
);

export default router;
