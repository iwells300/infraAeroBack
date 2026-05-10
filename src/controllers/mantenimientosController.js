import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient({});
const GRILLA_RWY_TABLE = 'public."grilla rwy v2"';

const normalizeDate = (fecha) => {
  const date = new Date(`${fecha}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKey = (date) => date.toISOString().slice(0, 10);

const isTimeRangeValid = (horaInicio, horaFin) => {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  return timePattern.test(horaInicio) && timePattern.test(horaFin) && horaInicio < horaFin;
};

const ensureMantenimientosTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.mantenimientos (
      id SERIAL PRIMARY KEY,
      zona_id TEXT NOT NULL,
      fecha TIMESTAMP(3) NOT NULL,
      fecha_fin TIMESTAMP(3),
      hora_inicio VARCHAR(5) NOT NULL,
      hora_fin VARCHAR(5) NOT NULL,
      tarea VARCHAR(255) NOT NULL,
      prioridad VARCHAR(20) NOT NULL,
      estado VARCHAR(30) NOT NULL DEFAULT 'programado',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mantenimientos
      DROP CONSTRAINT IF EXISTS "Mantenimiento_zona_id_fkey",
      DROP CONSTRAINT IF EXISTS "mantenimientos_zona_id_fkey"
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mantenimientos
      ALTER COLUMN zona_id TYPE TEXT,
      ADD COLUMN IF NOT EXISTS fecha_fin TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'programado',
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS mantenimientos_zona_id_idx ON public.mantenimientos (zona_id)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS mantenimientos_fecha_idx ON public.mantenimientos (fecha)
  `);
};

const findGrillaMantenimiento = async (zonaId) => {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      ogc_fid::int as fid,
      sector,
      seccion,
      umuestra,
      area_2::float8 as area,
      pcr,
      valorpcr::float8 as valorpcr
    FROM ${GRILLA_RWY_TABLE}
    WHERE ogc_fid = $1
    LIMIT 1
  `, Number(zonaId));

  return rows[0] || null;
};

export const getMantenimientos = async (req, res) => {
  const { zona_id, fecha_desde, fecha_hasta } = req.query;

  try {
    await ensureMantenimientosTable();

    const filters = [];
    const params = [];

    if (zona_id) {
      params.push(String(zona_id));
      filters.push(`m.zona_id = $${params.length}`);
    }

    if (fecha_desde) {
      const desde = normalizeDate(fecha_desde);
      if (!desde) return res.status(400).json({ error: 'fecha_desde invalida' });
      params.push(desde);
      filters.push(`m.fecha >= $${params.length}`);
    }

    if (fecha_hasta) {
      const hasta = normalizeDate(fecha_hasta);
      if (!hasta) return res.status(400).json({ error: 'fecha_hasta invalida' });
      params.push(hasta);
      filters.push(`m.fecha <= $${params.length}`);
    }

    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const mantenimientos = await prisma.$queryRawUnsafe(`
      SELECT
        m.*,
        json_build_object(
          'fid', g.ogc_fid,
          'nombre', CONCAT_WS(' - ', g.sector, NULLIF(g.seccion, '---'), NULLIF(g.umuestra, '---')),
          'sector', g.sector,
          'seccion', g.seccion,
          'umuestra', g.umuestra,
          'area', g.area_2,
          'pcr', g.pcr,
          'valorpcr', g.valorpcr
        ) as zona
      FROM public.mantenimientos m
      LEFT JOIN ${GRILLA_RWY_TABLE} g ON g.ogc_fid::text = m.zona_id
      ${whereSql}
      ORDER BY m.fecha ASC, m.hora_inicio ASC
    `, ...params);

    res.json(mantenimientos);
  } catch (error) {
    console.error('Error al obtener mantenimientos:', error);
    res.status(500).json({ error: 'Error interno al obtener la agenda de mantenimiento' });
  }
};

export const createMantenimiento = async (req, res) => {
  const { zona_id, fecha, fecha_fin, hora_inicio, hora_fin, tarea, prioridad } = req.body;

  try {
    await ensureMantenimientosTable();

    if (!zona_id || !fecha || !hora_inicio || !hora_fin || !tarea || !prioridad) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const fechaNormalizada = normalizeDate(fecha);
    if (!fechaNormalizada) {
      return res.status(400).json({ error: 'Fecha invalida' });
    }

    const fechaFinNormalizada = fecha_fin ? normalizeDate(fecha_fin) : fechaNormalizada;
    if (!fechaFinNormalizada) {
      return res.status(400).json({ error: 'Fecha de fin invalida' });
    }

    if (dateKey(fechaFinNormalizada) < dateKey(fechaNormalizada)) {
      return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la fecha de inicio' });
    }

    if (!isTimeRangeValid(hora_inicio, hora_fin)) {
      return res.status(400).json({ error: 'El rango horario es invalido' });
    }

    const prioridadesPermitidas = ['baja', 'media', 'alta', 'critica'];
    if (!prioridadesPermitidas.includes(prioridad)) {
      return res.status(400).json({ error: 'Prioridad invalida' });
    }

    const zona = await findGrillaMantenimiento(zona_id);
    if (!zona) {
      return res.status(404).json({ error: 'Sector de grilla no encontrado' });
    }

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO public.mantenimientos (
        zona_id,
        fecha,
        fecha_fin,
        hora_inicio,
        hora_fin,
        tarea,
        prioridad,
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING *
    `, String(zona_id), fechaNormalizada, fechaFinNormalizada, hora_inicio, hora_fin, tarea, prioridad);

    res.status(201).json({ mensaje: 'Mantenimiento agendado exitosamente', mantenimiento: rows[0] });
  } catch (error) {
    console.error('Error al crear mantenimiento:', error);
    res.status(500).json({ error: 'Error interno al guardar el mantenimiento' });
  }
};

export const updateEstadoMantenimiento = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    await ensureMantenimientosTable();

    const estadosPermitidos = ['programado', 'en_proceso', 'completado', 'cancelado'];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado invalido' });
    }

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE public.mantenimientos
      SET estado = $1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, estado, Number(id));

    const mantenimiento = rows[0];
    if (!mantenimiento) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' });
    }

    res.json(mantenimiento);
  } catch (error) {
    console.error('Error al actualizar mantenimiento:', error);
    res.status(500).json({ error: 'Error interno al actualizar mantenimiento' });
  }
};
