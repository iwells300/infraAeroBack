import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { calcularInterpolacion } from '../services/interpolacion.js';

const prisma = new PrismaClient({});

export const createRegistro = async (req, res) => {
  const { zona_id, fecha, observaciones, mediciones, valor_interpolado, dropdownSeleccion, ...otrosInputs } = req.body;

  try {
    // 1. Validar inputs básicos
    if (!zona_id || valor_interpolado === undefined || !mediciones || mediciones.length === 0) {
      return res.status(400).json({ error: 'Faltan campos requeridos: zona_id, mediciones, valor_interpolado' });
    }

    // Buscar al primer usuario de prueba si no se provee uno
    const usuario = await prisma.usuario.findFirst();
    if (!usuario) {
       return res.status(500).json({ error: 'No hay usuarios configurados en el sistema' });
    }

    // 2. Guardar en la base de datos
    const registro = await prisma.registro.create({
      data: {
        zona_id,
        usuario_id: usuario.id,
        fecha: fecha ? new Date(fecha) : new Date(),
        inputs: {
          mediciones, // Arreglo de interpolaciones
          observaciones,
          dropdownSeleccion,
          ...otrosInputs
        },
        valor_interpolado: Number(valor_interpolado)
      }
    });

    res.status(201).json({ mensaje: 'Registro creado exitosamente', registro });

  } catch (error) {
    console.error('Error al crear registro:', error);
    res.status(500).json({ error: 'Error interno al guardar el registro' });
  }
};

export const getRegistrosByZona = async (req, res) => {
  const { zona_id } = req.params;

  try {
    const registros = await prisma.registro.findMany({
      where: { zona_id },
      orderBy: { fecha: 'asc' },
      take: 50 // Mostrar últimos 50
    });

    res.json(registros);
  } catch (error) {
    console.error('Error al obtener registros:', error);
    res.status(500).json({ error: 'Error interno al obtener el historial' });
  }
};
