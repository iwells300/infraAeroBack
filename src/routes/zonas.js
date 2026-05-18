import { Router } from 'express';
import { getZonasGeojson, getCdfBuffersGeojson, getFaarfieldHeavyAeronaves, getZonas, getZonaById } from '../controllers/zonasController.js';

const router = Router();

router.get('/geojson', getZonasGeojson);
router.get('/cdf-buffers/geojson', getCdfBuffersGeojson);
router.get('/faarfield-heavy/aeronaves', getFaarfieldHeavyAeronaves);
router.get('/', getZonas);
router.get('/:id', getZonaById);

export default router;
