-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'AUSENTE', 'RETARDO', 'JUSTIFICADA');

-- CreateTable
CREATE TABLE "configuracion_escuela" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "umbral_faltas" INTEGER NOT NULL DEFAULT 3,
    "ventana_dias" INTEGER NOT NULL DEFAULT 30,
    "avisar_falta_del_dia" BOOLEAN NOT NULL DEFAULT true,
    "zona_horaria" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_escuela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_docente" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cohorte_id" UUID NOT NULL,
    "titular" BOOLEAN NOT NULL DEFAULT true,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignacion_docente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencia" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "alumno_id" UUID NOT NULL,
    "cohorte_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL,
    "nota" TEXT,
    "registrado_por" UUID NOT NULL,
    "registrado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "destino" TEXT,
    "alumno_id" UUID,
    "clave" TEXT NOT NULL,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_en" TIMESTAMPTZ(6),
    "dispositivos" INTEGER NOT NULL DEFAULT 0,
    "leida_en" TIMESTAMPTZ(6),

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_escuela_tenant_id_key" ON "configuracion_escuela"("tenant_id");

-- CreateIndex
CREATE INDEX "asignacion_docente_tenant_id_idx" ON "asignacion_docente"("tenant_id");

-- CreateIndex
CREATE INDEX "asignacion_docente_cohorte_id_idx" ON "asignacion_docente"("cohorte_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_docente_usuario_id_cohorte_id_key" ON "asignacion_docente"("usuario_id", "cohorte_id");

-- CreateIndex
CREATE INDEX "asistencia_tenant_id_fecha_idx" ON "asistencia"("tenant_id", "fecha");

-- CreateIndex
CREATE INDEX "asistencia_tenant_id_cohorte_id_fecha_idx" ON "asistencia"("tenant_id", "cohorte_id", "fecha");

-- CreateIndex
CREATE INDEX "asistencia_tenant_id_alumno_id_fecha_idx" ON "asistencia"("tenant_id", "alumno_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "asistencia_alumno_id_cohorte_id_fecha_key" ON "asistencia"("alumno_id", "cohorte_id", "fecha");

-- CreateIndex
CREATE INDEX "notificacion_tenant_id_usuario_id_creada_en_idx" ON "notificacion"("tenant_id", "usuario_id", "creada_en");

-- CreateIndex
CREATE INDEX "notificacion_tenant_id_tipo_creada_en_idx" ON "notificacion"("tenant_id", "tipo", "creada_en");

-- CreateIndex
CREATE UNIQUE INDEX "notificacion_tenant_id_usuario_id_clave_key" ON "notificacion"("tenant_id", "usuario_id", "clave");

-- AddForeignKey
ALTER TABLE "configuracion_escuela" ADD CONSTRAINT "configuracion_escuela_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_cohorte_id_fkey" FOREIGN KEY ("cohorte_id") REFERENCES "cohorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_cohorte_id_fkey" FOREIGN KEY ("cohorte_id") REFERENCES "cohorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integridad de los parametros (§3): un umbral de 0 haria que TODA falta
-- disparara el aviso acumulado, y una ventana de 0 dias no contaria nada.
-- La regla vive en la base porque es invariante del dato, no de una pantalla.
-- ---------------------------------------------------------------------------
ALTER TABLE "configuracion_escuela"
  ADD CONSTRAINT configuracion_escuela_umbral_valido CHECK ("umbral_faltas" >= 1),
  ADD CONSTRAINT configuracion_escuela_ventana_valida CHECK ("ventana_dias" >= 1);

-- ---------------------------------------------------------------------------
-- RLS de las tablas nuevas (§3). El gate de aislamiento recorre pg_class y se
-- pone rojo si una tabla de negocio nace sin politica: esto no es opcional.
-- Se hace en bucle para que agregar una tabla a la lista sea una linea y no
-- copiar cuatro sentencias (donde se cuela el olvido).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'configuracion_escuela',
    'asignacion_docente',
    'asistencia',
    'notificacion'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = app_tenant_actual()) WITH CHECK (tenant_id = app_tenant_actual())',
      t || '_aislamiento', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Las escuelas que ya existen nacen con los parametros por omision.
--
-- Se siembra aqui y no "cuando alguien entre a configuracion" porque el motor
-- de avisos necesita parametros desde el primer pase de lista. El servicio
-- ademas cae a los mismos valores si la fila no existe: dos defensas para la
-- misma condicion, porque una escuela sin avisos falla en silencio.
-- ---------------------------------------------------------------------------
INSERT INTO "configuracion_escuela" ("id", "tenant_id", "actualizado_en")
SELECT gen_random_uuid(), t."id", now() FROM "tenant" t
ON CONFLICT ("tenant_id") DO NOTHING;
