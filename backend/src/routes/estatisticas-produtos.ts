import { Router } from 'express';
import { EstatisticaProdutoController } from '@controllers/EstatisticaProdutoController';
import { authMiddleware } from '@middleware/auth';

const router = Router();
router.get('/dashboard', authMiddleware, EstatisticaProdutoController.dashboard);

router.get(
  '/ranking',
  authMiddleware,
  EstatisticaProdutoController.ranking
);

router.get(
  '/melhores-dia',
  authMiddleware,
  EstatisticaProdutoController.melhoresDoDia
);

router.get(
  '/melhores-mes',
  authMiddleware,
  EstatisticaProdutoController.melhoresDoMes
);

router.get(
  '/melhores-ano',
  authMiddleware,
  EstatisticaProdutoController.melhoresDoAno
);

router.get(
  '/resumo',
  authMiddleware,
  EstatisticaProdutoController.resumo
);

export default router;
