import { Router } from 'express';
import { SiteTokenController } from '@controllers/SiteTokenController';

const router = Router();

router.post('/', SiteTokenController.create);

export default router;
