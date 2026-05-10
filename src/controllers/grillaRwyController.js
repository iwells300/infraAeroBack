import pkg from '@prisma/client';

const { PrismaClient } = pkg;

const prisma = new PrismaClient({});

const GRILLA_RWY_TABLE = 'public."grilla rwy v2"';

const ensureGrillaRwyEventosTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.grilla_rwy_eventos (
      id SERIAL PRIMARY KEY,
      grilla_fid INTEGER NOT NULL,
      umuestra VARCHAR(15),
      sector VARCHAR(20),
      seccion VARCHAR(10),
      area DOUBLE PRECISION,
      fecha TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      observaciones TEXT,
      "dropdownSeleccion" VARCHAR(100),
      mediciones JSONB NOT NULL,
      valor_interpolado DOUBLE PRECISION NOT NULL,
      pci DOUBLE PRECISION,
      usuario_id INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.grilla_rwy_eventos
      ADD COLUMN IF NOT EXISTS pci DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS valor_interpolado DOUBLE PRECISION
  `);
};

export const getGrillaRwyGeojson = async (req, res) => {
  try {
    await ensureGrillaRwyEventosTable();

    const grilla = await prisma.$queryRawUnsafe(`
      SELECT
        g.ogc_fid::int as fid,
        g.sector,
        g.seccion,
        g.umuestra,
        g.area_2::float8 as area,
        g.pcr,
        g.valorpcr::float8 as valorpcr,
        ROUND(COALESCE(e.pci, e.valor_interpolado)::numeric, 2)::float8 as ultimo_valor,
        e.fecha as ultimo_evento_fecha,
        public.ST_AsGeoJSON(g.wkb_geometry)::json as geometry
      FROM ${GRILLA_RWY_TABLE} g
      LEFT JOIN LATERAL (
        SELECT pci, valor_interpolado, fecha
        FROM public.grilla_rwy_eventos
        WHERE grilla_fid = g.ogc_fid
        ORDER BY fecha DESC, id DESC
        LIMIT 1
      ) e ON true
      WHERE g.wkb_geometry IS NOT NULL
      ORDER BY g.ogc_fid ASC
    `);

    res.json({
      type: 'FeatureCollection',
      features: grilla.map((item) => ({
        type: 'Feature',
        properties: {
          fid: item.fid,
          sector: item.sector,
          seccion: item.seccion,
          umuestra: item.umuestra,
          area: item.area,
          pcr: item.pcr,
          valorpcr: item.valorpcr,
          ultimo_valor: item.ultimo_valor,
          ultimo_evento_fecha: item.ultimo_evento_fecha,
        },
        geometry: item.geometry,
      })),
    });
  } catch (error) {
    console.error('Error al generar geojson de grilla rwy desde DB:', error);
    res.status(500).json({ error: 'Error interno al obtener la grilla RWY' });
  }
};

export const getGrillaRwyByFid = async (req, res) => {
  const { fid } = req.params;

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        ogc_fid::int as fid,
        sector,
        seccion,
        umuestra,
        area_2::float8 as area,
        pcr,
        valorpcr::float8 as valorpcr,
        public.ST_AsGeoJSON(wkb_geometry)::json as geometry
      FROM ${GRILLA_RWY_TABLE}
      WHERE ogc_fid = $1
      LIMIT 1
    `, Number(fid));

    const grilla = rows[0];

    if (!grilla) {
      return res.status(404).json({ error: 'Celda de grilla no encontrada' });
    }

    res.json({
      fid: grilla.fid,
      sector: grilla.sector,
      seccion: grilla.seccion,
      umuestra: grilla.umuestra,
      area: grilla.area,
      pcr: grilla.pcr,
      valorpcr: grilla.valorpcr,
      geometry: grilla.geometry,
    });
  } catch (error) {
    console.error('Error al obtener grilla RWY:', error);
    res.status(500).json({ error: 'Error al obtener la grilla RWY' });
  }
};
