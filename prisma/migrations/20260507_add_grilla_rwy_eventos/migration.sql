CREATE TABLE "grilla_rwy_eventos" (
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

CREATE INDEX "grilla_rwy_eventos_grilla_fid_idx" ON "grilla_rwy_eventos"("grilla_fid");
CREATE INDEX "grilla_rwy_eventos_fecha_idx" ON "grilla_rwy_eventos"("fecha");

ALTER TABLE "grilla_rwy_eventos"
  ADD CONSTRAINT "grilla_rwy_eventos_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
