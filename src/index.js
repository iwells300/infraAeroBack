import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import zonasRoutes from './routes/zonas.js';
import grillaRwyRoutes from './routes/grillaRwy.js';
import registrosRoutes from './routes/registros.js';
import curvasRoutes from './routes/curvas.js';
import mantenimientosRoutes from './routes/mantenimientos.js';

import path from 'path';
import { fileURLToPath } from 'url';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



console.log("Directorio actual (__dirname):", __dirname);
console.log("Buscando carpeta data en:", path.join(__dirname, 'data'));

// Middlewares
app.use(cors({
  origin: [/^http:\/\/(localhost|127\.0\.0\.1):517\d$/, "https://infraaero.onrender.com"]

})); // Permitir CORS para el frontend
// app.use(cors())
app.use(express.json()); // Parsear JSON del body

// Rutas
app.use('/api/zonas', zonasRoutes);
app.use('/api/grilla-rwy', grillaRwyRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/curvas', curvasRoutes);
app.use('/api/mantenimientos', mantenimientosRoutes);
app.use('/data', express.static(path.join(__dirname, '../data')));

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
