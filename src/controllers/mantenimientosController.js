import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient({});
const UNIDADES_MANTENIMIENTO_TABLE = 'public."unidades mantenimiento"';

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

const findUnidadMantenimiento = async (zonaId) => {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      ogc_fid::int as fid,
      nombre,
      unidad::float8 as unidad,
      unidadm,
      area::float8 as area,
      pcr,
      valorpcr::float8 as valorpcr
    FROM ${UNIDADES_MANTENIMIENTO_TABLE}
    WHERE ogc_fid = $1
    LIMIT 1
  `, Number(zonaId));

  return rows[0] || null;
};

export const getUnidadesMantenimientoGeojson = async (req, res) => {
  try {
    const unidades = await prisma.$queryRawUnsafe(`
      SELECT
        ogc_fid::int as fid,
        nombre,
        unidad::float8 as unidad,
        unidadm,
        area::float8 as area,
        pcr,
        valorpcr::float8 as valorpcr,
        public.ST_AsGeoJSON(wkb_geometry)::json as geometry
      FROM ${UNIDADES_MANTENIMIENTO_TABLE}
      WHERE wkb_geometry IS NOT NULL
      ORDER BY ogc_fid ASC
    `);

    res.json({
      type: 'FeatureCollection',
      features: unidades.map((item) => ({
        type: 'Feature',
        properties: {
          fid: item.fid,
          nombre: item.nombre,
          unidad: item.unidad,
          unidadm: item.unidadm,
          area: item.area,
          pcr: item.pcr,
          valorpcr: item.valorpcr,
        },
        geometry: item.geometry,
      })),
    });
  } catch (error) {
    console.error('Error al generar GeoJSON de unidades de mantenimiento:', error);
    res.status(500).json({ error: 'Error interno al obtener las unidades de mantenimiento' });
  }
};

export const getUnidadMantenimientoByFid = async (req, res) => {
  const { fid } = req.params;

  try {
    const unidad = await findUnidadMantenimiento(fid);

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad de mantenimiento no encontrada' });
    }

    res.json(unidad);
  } catch (error) {
    console.error('Error al obtener unidad de mantenimiento:', error);
    res.status(500).json({ error: 'Error al obtener la unidad de mantenimiento' });
  }
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
          'nombre', g.nombre,
          'unidad', g.unidad,
          'unidadm', g.unidadm,
          'area', g.area,
          'pcr', g.pcr,
          'valorpcr', g.valorpcr
        ) as zona
      FROM public.mantenimientos m
      LEFT JOIN ${UNIDADES_MANTENIMIENTO_TABLE} g ON g.ogc_fid::text = m.zona_id
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

    const zona = await findUnidadMantenimiento(zona_id);
    if (!zona) {
      return res.status(404).json({ error: 'Unidad de mantenimiento no encontrada' });
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
