import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import zonasRoutes from './routes/zonas.js';
import registrosRoutes from './routes/registros.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors()); // Permitir CORS para el frontend
app.use(express.json()); // Parsear JSON del body

// Rutas
app.use('/api/zonas', zonasRoutes);
app.use('/api/registros', registrosRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
