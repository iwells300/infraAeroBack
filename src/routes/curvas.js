import { Router } from 'express';
import { getCurvas } from '../controllers/curvasController.js';

const router = Router();

router.get('/', getCurvas);

export default router;
