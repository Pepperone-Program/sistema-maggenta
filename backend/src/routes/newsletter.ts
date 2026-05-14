import { Router } from 'express';
import { NewsletterController } from '@controllers/NewsletterController';

const router = Router();

router.post('/', NewsletterController.create);

export default router;
