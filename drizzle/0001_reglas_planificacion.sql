-- Reglas de planificación garantizadas por PostgreSQL.
--
-- La aplicación comprueba lo mismo antes de insertar (src/domain/scheduling.ts)
-- para dar mensajes claros al usuario. Estas restricciones son la red de
-- seguridad: dos peticiones simultáneas, o una escritura que no pase por la
-- aplicación, no pueden dejar datos que incumplan las reglas.
-- Las visitas canceladas quedan fuera de las exclusiones (WHERE status =
-- 'scheduled'): cancelar libera el hueco sin borrar la visita.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Regla c) La visita empieza y termina el mismo día, dentro de la jornada
-- de 08:00 a 17:00.
ALTER TABLE "visits" ADD CONSTRAINT "visits_working_hours_check" CHECK (
  "ends_at" > "starts_at"
  AND "starts_at"::date = "ends_at"::date
  AND "starts_at"::time >= TIME '08:00'
  AND "ends_at"::time <= TIME '17:00'
);
--> statement-breakpoint

-- Regla a) Un técnico no puede tener dos visitas programadas que se solapen.
-- tsrange es semiabierto [inicio, fin): terminar a las 10:00 y empezar a las
-- 10:00 no es solape.
ALTER TABLE "visits" ADD CONSTRAINT "visits_no_overlap" EXCLUDE USING gist (
  "technician_id" WITH =,
  tsrange("starts_at", "ends_at") WITH &&
) WHERE ("status" = 'scheduled');
--> statement-breakpoint

-- Regla b) Entre dos visitas programadas del mismo técnico en obras distintas
-- debe haber al menos 30 minutos. Si se ensancha cada visita 15 minutos por
-- cada lado, dos visitas chocan exactamente cuando las separan menos de 30.
ALTER TABLE "visits" ADD CONSTRAINT "visits_travel_time" EXCLUDE USING gist (
  "technician_id" WITH =,
  "site_id" WITH <>,
  tsrange("starts_at" - INTERVAL '15 minutes', "ends_at" + INTERVAL '15 minutes') WITH &&
) WHERE ("status" = 'scheduled');
