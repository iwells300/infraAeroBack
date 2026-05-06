import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient({});

export const getCurvas = async (req, res) => {
  try {
    const curvas = await prisma.curva.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json(curvas);
  } catch (error) {
    console.error('Error al obtener curvas de la DB:', error);
    res.status(500).json({ error: 'Error al obtener curvas' });
  }
};
