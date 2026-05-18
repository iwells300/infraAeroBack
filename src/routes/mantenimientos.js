import { Router } from 'express';
import {
  createMantenimiento,
  getMantenimientos,
  getUnidadMantenimientoByFid,
  getUnidadesMantenimientoGeojson,
  updateEstadoMantenimiento
} from '../controllers/mantenimientosController.js';

const router = Router();

router.get('/unidades/geojson', getUnidadesMantenimientoGeojson);
router.get('/unidades/:fid', getUnidadMantenimientoByFid);
router.get('/', getMantenimientos);
router.post('/', createMantenimiento);
router.patch('/:id/estado', updateEstadoMantenimiento);

export default router;
