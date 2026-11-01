// Tests de integración: aplican las migraciones de drizzle/ a un PostgreSQL en
// memoria (PGlite) y comprueban que la base de datos impone las tres reglas por
// sí sola, sin pasar por la aplicación, y que acepta lo mismo que validateVisit.

import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type ExistingVisit, type RuleCode, validateVisit } from "../domain/scheduling";
import { formatMinutes, parseTime } from "../domain/time";
import { constraintViolation } from "./errors";
import * as schema from "./schema";
import { sites, technicians, visits } from "./schema";

const DAY = "2026-11-02";
// Identificadores que asigna la base de datos recién creada.
const ANA = 1;
const BRUNO = 2;
const OBRA_A = 1;
const OBRA_B = 2;
const OBRA_C = 3;

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

beforeAll(async () => {
  client = await PGlite.create({ extensions: { btree_gist } });
  db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  await db.insert(technicians).values([{ name: "Ana" }, { name: "Bruno" }]);
  await db
    .insert(sites)
    .values(["A", "B", "C"].map((letter) => ({ name: `Obra ${letter}`, municipality: "Terrassa", address: "-" })));
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await db.delete(visits);
});

/** Inserta una visita el día de prueba ("HH:MM") y devuelve su id. */
async function insertVisit(technicianId: number, siteId: number, from: string, to: string) {
  const [row] = await db
    .insert(visits)
    .values({ technicianId, siteId, startsAt: `${DAY} ${from}:00`, endsAt: `${DAY} ${to}:00` })
    .returning({ id: visits.id });
  return row.id;
}

/** Regla por la que la base de datos rechaza la operación, o null si la acepta. */
async function rejectedBy(operation: PromiseLike<unknown>): Promise<RuleCode | null> {
  try {
    await operation;
    return null;
  } catch (error) {
    const violation = constraintViolation(error);
    if (!violation) throw error;
    return violation.rule;
  }
}

describe("restricciones de PostgreSQL", () => {
  it("rechaza dos visitas del mismo técnico que se solapan", async () => {
    await insertVisit(ANA, OBRA_A, "09:00", "10:00");
    expect(await rejectedBy(insertVisit(ANA, OBRA_A, "09:30", "10:30"))).toBe("OVERLAP");
    expect(await rejectedBy(insertVisit(BRUNO, OBRA_A, "09:30", "10:30"))).toBeNull();
  });

  it("exige 30 minutos entre visitas a obras distintas", async () => {
    await insertVisit(ANA, OBRA_A, "09:00", "10:00");
    expect(await rejectedBy(insertVisit(ANA, OBRA_B, "10:29", "11:00"))).toBe("TRAVEL_TIME");
    expect(await rejectedBy(insertVisit(ANA, OBRA_B, "08:00", "08:31"))).toBe("TRAVEL_TIME");
    expect(await rejectedBy(insertVisit(ANA, OBRA_B, "10:30", "11:00"))).toBeNull();
  });

  it("permite visitas seguidas en la misma obra", async () => {
    await insertVisit(ANA, OBRA_A, "09:00", "10:00");
    expect(await rejectedBy(insertVisit(ANA, OBRA_A, "10:00", "11:00"))).toBeNull();
  });

  it("solo admite visitas dentro de la jornada", async () => {
    expect(await rejectedBy(insertVisit(ANA, OBRA_A, "07:30", "08:30"))).toBe("WORKING_HOURS");
    expect(await rejectedBy(insertVisit(ANA, OBRA_A, "16:30", "17:30"))).toBe("WORKING_HOURS");
    expect(await rejectedBy(insertVisit(ANA, OBRA_A, "10:00", "10:00"))).toBe("WORKING_HOURS");
    expect(await rejectedBy(insertVisit(ANA, OBRA_A, "08:00", "17:00"))).toBeNull();
  });

  it("una visita cancelada libera su hueco y no se puede reactivar si ya choca", async () => {
    const cancelled = await insertVisit(ANA, OBRA_A, "09:00", "10:00");
    await db.update(visits).set({ status: "cancelled" }).where(eq(visits.id, cancelled));

    expect(await rejectedBy(insertVisit(ANA, OBRA_A, "09:30", "10:30"))).toBeNull();
    expect(
      await rejectedBy(db.update(visits).set({ status: "scheduled" }).where(eq(visits.id, cancelled))),
    ).toBe("OVERLAP");
  });

  it("una visita se puede reprogramar sobre su propio horario, pero no encima de otra", async () => {
    const visit = await insertVisit(ANA, OBRA_A, "09:00", "10:00");
    await insertVisit(ANA, OBRA_A, "11:00", "12:00");
    const reschedule = (siteId: number, from: string, to: string) =>
      db
        .update(visits)
        .set({ siteId, startsAt: `${DAY} ${from}:00`, endsAt: `${DAY} ${to}:00` })
        .where(eq(visits.id, visit));

    expect(await rejectedBy(reschedule(OBRA_A, "09:30", "10:30"))).toBeNull();
    expect(await rejectedBy(reschedule(OBRA_A, "10:30", "11:30"))).toBe("OVERLAP");
    expect(await rejectedBy(reschedule(OBRA_B, "09:45", "10:45"))).toBe("TRAVEL_TIME");
  });
});

describe("PostgreSQL y validateVisit", () => {
  it("aceptan exactamente las mismas visitas", { timeout: 30_000 }, async () => {
    // Agenda de Ana: obra A de 10:00 a 11:00 y obra B de 13:00 a 14:00.
    const agenda: ExistingVisit[] = [];
    for (const [siteId, from, to] of [
      [OBRA_A, "10:00", "11:00"],
      [OBRA_B, "13:00", "14:00"],
    ] as const) {
      const id = await insertVisit(ANA, siteId, from, to);
      agenda.push({
        id,
        technicianId: ANA,
        siteId,
        date: DAY,
        start: parseTime(from)!,
        end: parseTime(to)!,
        status: "scheduled",
        siteLabel: `Obra ${siteId}`,
      });
    }

    // Candidatas cada 5 min de 07:30 a 17:00, en la misma obra que la primera
    // visita y en una tercera obra.
    const disagreements: string[] = [];
    const counts = { accepted: 0, rejected: 0 };
    for (const siteId of [OBRA_A, OBRA_C]) {
      for (let start = 7 * 60 + 30; start <= 17 * 60; start += 5) {
        for (const duration of [15, 45, 60]) {
          const from = formatMinutes(start);
          const to = formatMinutes(start + duration);
          const appAccepts =
            validateVisit({ technicianId: ANA, siteId, date: DAY, start, end: start + duration }, agenda)
              .length === 0;

          let dbAccepts = true;
          try {
            const id = await insertVisit(ANA, siteId, from, to);
            await db.delete(visits).where(eq(visits.id, id));
          } catch (error) {
            if (!constraintViolation(error)) throw error;
            dbAccepts = false;
          }

          counts[dbAccepts ? "accepted" : "rejected"]++;
          if (appAccepts !== dbAccepts) {
            disagreements.push(`obra ${siteId} ${from}–${to}: app ${appAccepts}, PostgreSQL ${dbAccepts}`);
          }
        }
      }
    }

    expect(disagreements).toEqual([]);
    expect(counts.accepted).toBeGreaterThan(0);
    expect(counts.rejected).toBeGreaterThan(0);
  });
});
