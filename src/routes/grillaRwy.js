import { Router } from 'express';
import { getGrillaRwyGeojson, getGrillaRwyByFid } from '../controllers/grillaRwyController.js';
import { createGrillaRwyEvento, getGrillaRwyEventoById, getUltimoEventoGrillaRwyByFid } from '../controllers/grillaRwyEventosController.js';

const router = Router();

router.post('/eventos', createGrillaRwyEvento);
router.get('/eventos/detalle/:id', getGrillaRwyEventoById);
router.get('/eventos/:fid', getUltimoEventoGrillaRwyByFid);
router.get('/geojson', getGrillaRwyGeojson);
router.get('/:fid', getGrillaRwyByFid);

export default router;
