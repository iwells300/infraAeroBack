import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadData() {
  try {
    console.log('Cargando zonas desde zonas.sql...');
    const zonasSqlPath = path.join(__dirname, '../../zonas.sql');
    const zonasSql = fs.readFileSync(zonasSqlPath, 'utf8');
    const insertLines = zonasSql.split('\n').filter(line => line.trim().startsWith('INSERT'));
    
    for (const line of insertLines) {
      await prisma.$executeRawUnsafe(line);
    }
    console.log('Zonas insertadas correctamente.');

    const curvasPath = path.join(__dirname, '../../curvasRigidas.json');
    const data = fs.readFileSync(curvasPath, 'utf8');
    const curvas = JSON.parse(data);

    console.log('Borrando curvas existentes...');
    await prisma.curva.deleteMany({});

    console.log('Insertando curvas...');
    for (const [nombre, puntos] of Object.entries(curvas)) {
      await prisma.curva.create({
        data: {
          nombre: nombre,
          puntos: puntos
        }
      });
      console.log(`Curva ${nombre} insertada.`);
    }

    console.log('Carga de datos completada exitosamente.');
  } catch (error) {
    console.error('Error al cargar los datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

loadData();
