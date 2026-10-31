import { index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { VISIT_STATUSES } from "../domain/scheduling";

export const visitStatus = pgEnum("visit_status", VISIT_STATUSES);

export const technicians = pgTable("technicians", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  phone: text("phone"),
});

export const sites = pgTable("sites", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  municipality: text("municipality").notNull(),
  address: text("address").notNull(),
});

// Las reglas de planificación (jornada, solape y desplazamiento) se imponen
// también con restricciones CHECK / EXCLUDE escritas a mano en
// drizzle/0001_reglas_planificacion.sql, porque Drizzle no sabe declarar
// restricciones de exclusión.
export const visits = pgTable(
  "visits",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    technicianId: integer("technician_id")
      .notNull()
      .references(() => technicians.id),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id),
    // Hora local sin zona horaria, leída como texto ("2026-11-03 09:30:00")
    // para que ningún Date la desplace al ejecutarse en un servidor en UTC.
    startsAt: timestamp("starts_at", { mode: "string" }).notNull(),
    endsAt: timestamp("ends_at", { mode: "string" }).notNull(),
    status: visitStatus("status").notNull().default("scheduled"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { mode: "string", withTimezone: true }),
  },
  (t) => [
    index("visits_starts_at_idx").on(t.startsAt),
    index("visits_technician_starts_at_idx").on(t.technicianId, t.startsAt),
  ],
);
