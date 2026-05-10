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

export const getZonas = async (req, res) => {
  try {
    const zonas = await prisma.zona.findMany();
    res.json(zonas);
  } catch (error) {
    console.error('Error al obtener zonas de la DB:', error);
    res.status(500).json({ error: 'Error al obtener zonas' });
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

    res.json({
      ...zona,
      estructura
    });
  } catch (error) {
    console.error('Error al obtener zona:', error);
    res.status(500).json({ error: 'Error al obtener zona' });
  }
};
