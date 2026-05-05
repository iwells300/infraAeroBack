import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const calcularInterpolacion = (zona_id, valorX) => {
  try {
    const curvasPath = path.join(__dirname, '../../data/curvas.json');
    const data = fs.readFileSync(curvasPath, 'utf8');
    const curvas = JSON.parse(data);

    const zonaCurva = curvas.find((c) => c.zona_id === zona_id);

    if (!zonaCurva) {
      throw new Error(`No se encontró curva de calibración para la zona ${zona_id}`);
    }

    const puntos = zonaCurva.curva;

    // Ordenar puntos por x por seguridad
    puntos.sort((a, b) => a.x - b.x);

    // Verificar si X está fuera de rango
    if (valorX < puntos[0].x || valorX > puntos[puntos.length - 1].x) {
      throw new Error(`El valor ${valorX} está fuera del rango de la curva para la zona ${zona_id} (${puntos[0].x} a ${puntos[puntos.length - 1].x})`);
    }

    // Encontrar el intervalo correcto
    for (let i = 0; i < puntos.length - 1; i++) {
      const p1 = puntos[i];
      const p2 = puntos[i + 1];

      if (valorX >= p1.x && valorX <= p2.x) {
        // Interpolación lineal
        // y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
        const valorY = p1.y + ((valorX - p1.x) * (p2.y - p1.y)) / (p2.x - p1.x);
        
        // Redondear a 2 decimales
        return Math.round(valorY * 100) / 100;
      }
    }

    throw new Error('No se pudo calcular la interpolación');
  } catch (error) {
    throw error;
  }
};
