import pkg from '@prisma/client';

const { PrismaClient } = pkg;

const prisma = new PrismaClient({});
const GRILLA_RWY_TABLE = 'public."grilla rwy v2"';

const round2 = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : value;
};

const roundJsonNumbers = (value) => {
  if (Array.isArray(value)) return value.map(roundJsonNumbers);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, roundJsonNumbers(item)]),
    );
  }
  return typeof value === 'number' ? round2(value) : value;
};

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
      sample_size DOUBLE PRECISION,
      total_losas DOUBLE PRECISION,
      max_cdv DOUBLE PRECISION,
      max_allowable_deducts DOUBLE PRECISION,
      defectos JSONB,
      iteraciones JSONB,
      resultado JSONB,
      usuario_id INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.grilla_rwy_eventos
      ADD COLUMN IF NOT EXISTS pci DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS sample_size DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS total_losas DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS max_cdv DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS max_allowable_deducts DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS defectos JSONB,
      ADD COLUMN IF NOT EXISTS iteraciones JSONB,
      ADD COLUMN IF NOT EXISTS resultado JSONB
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS grilla_rwy_eventos_grilla_fid_idx
    ON public.grilla_rwy_eventos (grilla_fid)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS grilla_rwy_eventos_fecha_idx
    ON public.grilla_rwy_eventos (fecha)
  `);
};

export const createGrillaRwyEvento = async (req, res) => {
  const {
    grilla_fid,
    umuestra,
    sector,
    seccion,
    area,
    fecha,
    observaciones,
    mediciones,
    valor_interpolado,
    pci,
    sample_size,
    total_losas,
    max_cdv,
    max_allowable_deducts,
    defectos,
    iteraciones,
    resultado,
    dropdownSeleccion,
  } = req.body;

  try {
    const pciValue = pci ?? valor_interpolado;

    if (grilla_fid === undefined || grilla_fid === null || pciValue === undefined || !mediciones || mediciones.length === 0) {
      return res.status(400).json({ error: 'Faltan campos requeridos: grilla_fid, mediciones, pci' });
    }

    await ensureGrillaRwyEventosTable();
    const roundedMediciones = roundJsonNumbers(mediciones);
    const roundedDefectos = roundJsonNumbers(defectos || []);
    const roundedIteraciones = roundJsonNumbers(iteraciones || []);
    const roundedResultado = roundJsonNumbers(resultado || {});

    const usuario = await prisma.usuario.findFirst();
    if (!usuario) {
      return res.status(500).json({ error: 'No hay usuarios configurados en el sistema' });
    }

    const eventoRows = await prisma.$queryRaw`
      INSERT INTO public.grilla_rwy_eventos (
        grilla_fid,
        umuestra,
        sector,
        seccion,
        area,
        fecha,
        observaciones,
        "dropdownSeleccion",
        mediciones,
        valor_interpolado,
        pci,
        sample_size,
        total_losas,
        max_cdv,
        max_allowable_deducts,
        defectos,
        iteraciones,
        resultado,
        usuario_id,
        "updatedAt"
      )
      VALUES (
        ${Number(grilla_fid)},
        ${umuestra ? String(umuestra) : null},
        ${sector ? String(sector) : null},
        ${seccion ? String(seccion) : null},
        ${round2(area)},
        ${fecha ? new Date(fecha) : new Date()},
        ${observaciones || null},
        ${dropdownSeleccion || null},
        ${JSON.stringify(roundedMediciones)}::jsonb,
        ${round2(pciValue)},
        ${round2(pciValue)},
        ${round2(sample_size)},
        ${round2(total_losas)},
        ${round2(max_cdv)},
        ${round2(max_allowable_deducts)},
        ${JSON.stringify(roundedDefectos)}::jsonb,
        ${JSON.stringify(roundedIteraciones)}::jsonb,
        ${JSON.stringify(roundedResultado)}::jsonb,
        ${usuario.id},
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    res.status(201).json({ mensaje: 'Evento de grilla creado exitosamente', evento: eventoRows[0] });
  } catch (error) {
    console.error('Error al crear evento de grilla RWY:', error);
    res.status(500).json({ error: 'Error interno al guardar el evento de grilla' });
  }
};

export const getUltimoEventoGrillaRwyByFid = async (req, res) => {
  const { fid } = req.params;

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        g.ogc_fid::int as fid,
        g.sector,
        g.seccion,
        g.umuestra,
        g.area_2::float8 as area,
        g.pcr,
        g.valorpcr::float8 as valorpcr,
        public.ST_AsGeoJSON(g.wkb_geometry)::json as geometry
      FROM ${GRILLA_RWY_TABLE} g
      WHERE g.ogc_fid = $1
      LIMIT 1
    `, Number(fid));

    const grilla = rows[0];
    if (!grilla) {
      return res.status(404).json({ error: 'Celda de grilla no encontrada' });
    }

    await ensureGrillaRwyEventosTable();

    const ultimoEventoRows = await prisma.$queryRaw`
      SELECT *
      FROM public.grilla_rwy_eventos
      WHERE grilla_fid = ${Number(fid)}
      ORDER BY fecha DESC, id DESC
      LIMIT 1
    `;

    const eventos = await prisma.$queryRaw`
      SELECT
        id,
        fecha,
        ROUND(COALESCE(pci, valor_interpolado)::numeric, 2)::float8 as pci
      FROM public.grilla_rwy_eventos
      WHERE grilla_fid = ${Number(fid)}
      ORDER BY fecha DESC, id DESC
    `;

    res.json({
      grilla: {
        fid: grilla.fid,
        sector: grilla.sector,
        seccion: grilla.seccion,
        umuestra: grilla.umuestra,
        area: grilla.area,
        pcr: grilla.pcr,
        valorpcr: grilla.valorpcr,
        geometry: grilla.geometry,
      },
      ultimoEvento: ultimoEventoRows[0] || null,
      eventos,
    });
  } catch (error) {
    console.error('Error al obtener detalle de grilla RWY:', error);
    res.status(500).json({ error: 'Error al obtener el detalle de la grilla RWY' });
  }
};

export const getGrillaRwyEventoById = async (req, res) => {
  const { id } = req.params;

  try {
    await ensureGrillaRwyEventosTable();

    const rows = await prisma.$queryRaw`
      SELECT *
      FROM public.grilla_rwy_eventos
      WHERE id = ${Number(id)}
      LIMIT 1
    `;

    if (!rows[0]) {
      return res.status(404).json({ error: 'Evento de grilla no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener evento de grilla RWY:', error);
    res.status(500).json({ error: 'Error al obtener el evento de grilla RWY' });
  }
};
