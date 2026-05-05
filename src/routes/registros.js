import { Router } from 'express';
import { createRegistro, getRegistrosByZona } from '../controllers/registrosController.js';

const router = Router();

router.post('/', createRegistro);
router.get('/:zona_id', getRegistrosByZona);

export default router;
