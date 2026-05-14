import { Router } from 'express';
import { ContatoController } from '@controllers/ContatoController';

const router = Router();

router.post(
  '/',
  ContatoController.enviar
);

export default router;
