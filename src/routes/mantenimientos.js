import { Router } from 'express';
import {
  createMantenimiento,
  getMantenimientos,
  updateEstadoMantenimiento
} from '../controllers/mantenimientosController.js';

const router = Router();

router.get('/', getMantenimientos);
router.post('/', createMantenimiento);
router.patch('/:id/estado', updateEstadoMantenimiento);

export default router;
