CREATE TABLE IF NOT EXISTS "grilla_rwy_eventos" (
  "id" SERIAL NOT NULL,
  "grilla_fid" INTEGER NOT NULL,
  "umuestra" VARCHAR(15),
  "sector" VARCHAR(20),
  "seccion" VARCHAR(10),
  "area" DOUBLE PRECISION,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observaciones" TEXT,
  "dropdownSeleccion" VARCHAR(100),
  "mediciones" JSONB NOT NULL,
  "valor_interpolado" DOUBLE PRECISION NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "grilla_rwy_eventos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "grilla_rwy_eventos"
  ADD COLUMN IF NOT EXISTS "umuestra" VARCHAR(15),
  ADD COLUMN IF NOT EXISTS "sector" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "seccion" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "area" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "observaciones" TEXT,
  ADD COLUMN IF NOT EXISTS "dropdownSeleccion" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "mediciones" JSONB,
  ADD COLUMN IF NOT EXISTS "valor_interpolado" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "usuario_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "grilla_rwy_eventos_grilla_fid_idx" ON "grilla_rwy_eventos"("grilla_fid");
CREATE INDEX IF NOT EXISTS "grilla_rwy_eventos_fecha_idx" ON "grilla_rwy_eventos"("fecha");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'grilla_rwy_eventos_usuario_id_fkey'
  ) THEN
    ALTER TABLE "grilla_rwy_eventos"
      ADD CONSTRAINT "grilla_rwy_eventos_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
