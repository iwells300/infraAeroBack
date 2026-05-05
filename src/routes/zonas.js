import { Router } from 'express';
import { getZonasGeojson, getZonas, getZonaById } from '../controllers/zonasController.js';

const router = Router();

router.get('/geojson', getZonasGeojson);
router.get('/', getZonas);
router.get('/:id', getZonaById);

export default router;
