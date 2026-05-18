import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient({});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getZonasGeojson = async (req, res) => {
  try {
    const zonas = await prisma.$queryRaw`
      SELECT 
        nombre as zona_id,
        nombre,
        pcr,
        valorpcr::float8 as valorpcr,
        public.ST_AsGeoJSON(wkb_geometry)::json as geometry
      FROM public.zonas
      WHERE wkb_geometry IS NOT NULL AND nombre IS NOT NULL
    `;

    const features = [];

    for (let zona of zonas) {
      const zonaId = zona.zona_id;
      const ultimoRegistro = await prisma.registro.findFirst({
        where: { zona_id: zonaId },
        orderBy: { fecha: 'desc' }
      });

      features.push({
        type: 'Feature',
        properties: {
          zona_id: zonaId,
          nombre: zona.nombre,
          pcr: zona.pcr,
          valorpcr: zona.valorpcr,
          ultimo_valor: ultimoRegistro ? ultimoRegistro.valor_interpolado : null
        },
        geometry: zona.geometry
      });
    }

    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error('Error al generar geojson desde DB:', error);
    res.status(500).json({ error: 'Error interno al obtener las zonas geográficas' });
  }
};

export const getCdfBuffersGeojson = async (req, res) => {
  try {
    const buffers = await prisma.$queryRaw`
      WITH cdf_abs AS (
        SELECT
          zona_nombre,
          section_index,
          section_name,
          zona_valorpcr,
          round(abs(x_m::float8)::numeric, 3)::float8 as distance_m,
          max(cdf_y::float8) as cdf
        FROM public.faarfield_life_cdf_transversal
        WHERE series_type = 'section_total'
        GROUP BY zona_nombre, section_index, section_name, zona_valorpcr, round(abs(x_m::float8)::numeric, 3)
      ),
      buffers AS (
        SELECT
          *,
          round(abs((((ringid::float8 * 10) - 5) * 0.0254))::numeric, 3)::float8 as ring_center_m
        FROM public.buffer_cfd
        WHERE wkb_geometry IS NOT NULL
      )
      SELECT
        b.ogc_fid,
        b.c_nombre as zona_nombre,
        b.c_pcr as zona_pcr,
        b.c_valorpcr::float8 as zona_valorpcr,
        b.ringid::float8 as ringid,
        b.distance::float8 as distance_m,
        c.section_index,
        c.section_name,
        c.distance_m as x_m,
        c.cdf,
        public.ST_AsGeoJSON(b.wkb_geometry)::json as geometry
      FROM buffers b
      LEFT JOIN cdf_abs c
        ON c.zona_nombre = b.c_nombre
        AND c.distance_m = b.ring_center_m
        AND (
          c.zona_valorpcr::float8 = b.c_valorpcr::float8
          OR NOT EXISTS (
            SELECT 1
            FROM cdf_abs cx
            WHERE cx.zona_nombre = b.c_nombre
              AND cx.distance_m = b.ring_center_m
              AND cx.zona_valorpcr::float8 = b.c_valorpcr::float8
          )
        )
      ORDER BY b.c_nombre ASC, b.ringid ASC
    `;

    res.json({
      type: 'FeatureCollection',
      features: buffers.map((buffer) => ({
        type: 'Feature',
        properties: {
          ogc_fid: buffer.ogc_fid,
          zona_id: buffer.zona_nombre,
          zona_pcr: buffer.zona_pcr,
          zona_valorpcr: buffer.zona_valorpcr,
          ringid: buffer.ringid,
          distance_m: buffer.distance_m,
          section_index: buffer.section_index,
          section_name: buffer.section_name,
          x_m: buffer.x_m,
          cdf: buffer.cdf,
        },
        geometry: buffer.geometry,
      })),
    });
  } catch (error) {
    console.error('Error al generar geojson de buffers CDF:', error);
    res.status(500).json({ error: 'Error interno al obtener los buffers CDF' });
  }
};

export const getZonas = async (req, res) => {
  try {
    const zonas = await prisma.zona.findMany();
    res.json(zonas);
  } catch (error) {
    console.error('Error al obtener zonas de la DB:', error);
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
};

export const getFaarfieldHeavyAeronaves = async (req, res) => {
  try {
    const aeronaves = await prisma.$queryRaw`
      SELECT
        aircraft_id,
        aircraft_order,
        name_original,
        name_unique,
        manufacturer,
        is_belly,
        gear,
        number_gear,
        number_wheels,
        number_tire_tracks,
        gross_weight_lb::float8 as gross_weight_lb,
        annual_departures::float8 as annual_departures,
        annual_growth_pct::float8 as annual_growth_pct,
        total_departures::float8 as total_departures,
        tire_pressure_psi::float8 as tire_pressure_psi,
        tire_area_mm2::float8 as tire_area_mm2,
        tire_length_mm::float8 as tire_length_mm,
        tire_width_mm::float8 as tire_width_mm,
        acr_b::float8 as acr_b
      FROM public.faarfield_heavy_aeronaves
      ORDER BY name_unique ASC
    `;

    const ruedas = await prisma.$queryRaw`
      SELECT
        aircraft_id,
        wheel_index,
        x_mm::float8 as x_mm,
        x_m::float8 as x_m,
        y_mm::float8 as y_mm,
        y_m::float8 as y_m
      FROM public.faarfield_heavy_ruedas
      ORDER BY aircraft_id ASC, wheel_index ASC
    `;

    const cdfTransversal = await prisma.$queryRaw`
      SELECT
        section_name,
        series_type,
        aircraft_id,
        aircraft_name_unique,
        point_order,
        side,
        x_m::float8 as x_m,
        cdf_y::float8 as cdf_y,
        analysed_life_years::float8 as analysed_life_years
      FROM public.faarfield_heavy_cdf_transversal
      WHERE series_type = 'aircraft'
      ORDER BY section_name ASC, aircraft_id ASC, point_order ASC
    `;

    const acrWeights = await prisma.$queryRaw`
      SELECT
        weight_pct,
        structure_index,
        structure_name,
        section_pcr_new_pcn::float8 as section_pcr_new_pcn,
        aircraft_name,
        manufacturer,
        gross_weight_us::float8 as gross_weight_lb,
        number_departures::float8 as annual_departures,
        total_departures::float8 as total_departures,
        acrb::float8 as acr_b,
        gear,
        is_belly,
        tire_area_si::float8 as tire_area_mm2,
        tire_length_si::float8 as tire_length_mm,
        tire_width_si::float8 as tire_width_mm,
        cp_us::float8 as tire_pressure_psi,
        wheel_coordinates
      FROM public.faafield_aircraft_acr_wheels
      ORDER BY structure_index ASC, aircraft_name ASC, weight_pct ASC
    `;

    const cdfCurves = await prisma.$queryRaw`
      SELECT
        weight_pct,
        structure_index,
        structure_name,
        aircraft_name,
        point_index,
        cdf::float8 as cdf,
        gross_weight_us::float8 as gross_weight_lb,
        total_departures::float8 as total_departures,
        cdf_aircraft_max::float8 as cdf_aircraft_max
      FROM public.faafield_aircraft_cdf_curves
      ORDER BY structure_index ASC, aircraft_name ASC, weight_pct ASC, point_index ASC
    `;

    res.json({ aeronaves, ruedas, cdfTransversal, acrWeights, cdfCurves });
  } catch (error) {
    console.error('Error al obtener aeronaves FAARFIELD heavy:', error);
    res.status(500).json({ error: 'Error interno al obtener aeronaves FAARFIELD heavy' });
  }
};

export const getZonaById = async (req, res) => {
  const { id } = req.params;
  try {
    const zona = await prisma.zona.findUnique({
      where: { nombre: id },
      include: {
        registros: {
          orderBy: { fecha: 'desc' },
          take: 1
        }
      }
    });

    if (!zona) return res.status(404).json({ error: 'Zona no encontrada' });

    // Devolver la zona y su último registro
    const estructura = await prisma.$queryRaw`
      SELECT
        zona_estructura_id,
        layer_no,
        layer_role,
        faarfield_material,
        faarfield_category,
        espesor_cm::float8 as espesor_cm,
        modulus_mpa::float8 as modulus_mpa,
        modulus_psi::float8 as modulus_psi,
        rupture_modulus_psi::float8 as rupture_modulus_psi,
        cbr_rasante::float8 as cbr_rasante,
        k_value_pci::float8 as k_value_pci,
        paquete_supuesto,
        confianza
      FROM public.zonas_estructuras
      WHERE nombre_zona = ${id}
      ORDER BY layer_no ASC
    `;

    const aviones = await prisma.$queryRaw`
      SELECT
        zona_nombre,
        section_index,
        section_name,
        analysed_life_years::float8 as analysed_life_years,
        aircraft_order,
        manufacturer,
        aircraft_name,
        gear,
        gross_weight_lb::float8 as gross_weight_lb,
        annual_departures::float8 as annual_departures,
        annual_growth_pct::float8 as annual_growth_pct,
        total_departures::float8 as total_departures,
        acr_b::float8 as acr_b,
        cdf_aircraft_max::float8 as cdf_aircraft_max,
        tire_pressure_psi::float8 as tire_pressure_psi,
        tire_area_mm2::float8 as tire_area_mm2,
        tire_length_mm::float8 as tire_length_mm,
        tire_width_mm::float8 as tire_width_mm,
        wheel_coordinates_json
      FROM public.faarfield_life_aviones
      WHERE zona_nombre = ${id}
      ORDER BY section_index ASC, aircraft_order ASC, aircraft_name ASC
    `;

    const cdfTransversal = await prisma.$queryRaw`
      SELECT
        zona_nombre,
        section_index,
        section_name,
        analysed_life_years::float8 as analysed_life_years,
        series_type,
        aircraft_order,
        aircraft_name,
        cdf_raw_index,
        side,
        x_m::float8 as x_m,
        cdf_y::float8 as cdf_y
      FROM public.faarfield_life_cdf_transversal
      WHERE zona_nombre = ${id}
      ORDER BY section_index ASC, series_type ASC, aircraft_order ASC, x_m ASC, cdf_raw_index ASC
    `;

    res.json({
      ...zona,
      estructura,
      aviones,
      cdfTransversal
    });
  } catch (error) {
    console.error('Error al obtener zona:', error);
    res.status(500).json({ error: 'Error al obtener zona' });
  }
};
