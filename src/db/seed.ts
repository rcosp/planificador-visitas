// Datos de ejemplo inventados. Vacía las tablas y las vuelve a cargar, con las
// visitas repartidas en torno a la fecha actual para que la demo siempre tenga
// agenda. Uso: npm run db:seed

import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { type ExistingVisit, validateVisit } from "../domain/scheduling";
import { addDays, parseTime, toTimestamp } from "../domain/time";
import { closeDb, getDb } from "./client";
import { sites, technicians, visits } from "./schema";

loadEnvConfig(process.cwd());

const TECHNICIANS = [
  { name: "Laura Martínez", phone: "600 111 222" },
  { name: "Jordi Puig", phone: "600 333 444" },
  { name: "Marta Soler", phone: "600 555 666" },
  { name: "Àlex Ferrer", phone: "600 777 888" },
];

const SITES = [
  { name: "Edificio Rambla", municipality: "Terrassa", address: "Rambla d'Ègara, 245" },
  { name: "Ampliación CAP Sant Pere", municipality: "Terrassa", address: "Carrer de Sant Pere, 80" },
  { name: "Naves Can Roqueta", municipality: "Sabadell", address: "Carrer de Can Roqueta, 12" },
  { name: "Escuela Ca n'Oriol", municipality: "Rubí", address: "Avinguda de Ca n'Oriol, 30" },
  { name: "Residencial Mirasol", municipality: "Sant Cugat del Vallès", address: "Carrer de Mirasol, 8" },
  { name: "Viviendas Plaça Nova", municipality: "Matadepera", address: "Plaça Nova, 3" },
  { name: "Centro cívico El Palau", municipality: "Castellar del Vallès", address: "Carrer del Palau, 15" },
];

// [día laborable relativo a hoy, técnico, obra, hora de inicio, duración en min, cancelada]
// Los índices de técnico y obra se refieren a las listas de arriba.
type SeedVisit = [day: number, tech: number, site: number, start: string, minutes: number, cancelled?: boolean];

const VISITS: SeedVisit[] = [
  [-1, 1, 3, "09:00", 60],
  [-1, 2, 6, "10:00", 120],

  [0, 0, 0, "08:30", 90],
  [0, 0, 1, "10:30", 90], // justo 30 min después, en otra obra
  [0, 0, 2, "13:00", 90],
  [0, 1, 3, "09:00", 120],
  [0, 1, 4, "11:45", 90],
  [0, 2, 5, "08:00", 90],
  [0, 2, 6, "10:00", 60],
  [0, 2, 6, "11:00", 60], // seguida en la misma obra, sin hueco
  [0, 3, 4, "10:00", 90, true],
  [0, 3, 2, "10:30", 90], // ocupa el hueco que dejó la cancelada
  [0, 3, 2, "15:00", 120], // termina justo a las 17:00

  [1, 0, 4, "09:00", 90],
  [1, 0, 3, "11:00", 90],
  [1, 1, 1, "08:00", 240],
  [1, 2, 2, "14:00", 120],

  [2, 3, 5, "08:30", 60],
  [2, 3, 0, "10:00", 90],
  [2, 0, 6, "12:00", 60, true],
  [2, 1, 2, "09:00", 60],
];

function todayInMadrid(): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** Día laborable `offset` posiciones después (o antes) del primer laborable desde hoy. */
function workday(firstWorkday: string, offset: number): string {
  let date = firstWorkday;
  const step = offset < 0 ? -1 : 1;
  for (let remaining = Math.abs(offset); remaining > 0; ) {
    date = addDays(date, step);
    if (!isWeekend(date)) remaining--;
  }
  return date;
}

async function main() {
  let firstWorkday = todayInMadrid();
  while (isWeekend(firstWorkday)) firstWorkday = addDays(firstWorkday, 1);

  try {
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE visits, sites, technicians RESTART IDENTITY CASCADE`);
      const techRows = await tx.insert(technicians).values(TECHNICIANS).returning();
      const siteRows = await tx.insert(sites).values(SITES).returning();

      // Las visitas pasan por las mismas reglas que la aplicación, así que un
      // error al editar esta lista se detecta con un mensaje claro.
      const saved: ExistingVisit[] = [];
      for (const [day, techIndex, siteIndex, startTime, minutes, cancelled] of VISITS) {
        const tech = techRows[techIndex];
        const site = siteRows[siteIndex];
        const date = workday(firstWorkday, day);
        const start = parseTime(startTime)!;
        const slot = { technicianId: tech.id, siteId: site.id, date, start, end: start + minutes };

        if (!cancelled) {
          const violations = validateVisit(slot, saved);
          if (violations.length > 0) {
            throw new Error(
              `Visita de ejemplo inválida (${tech.name}, ${date} ${startTime}): ` +
                violations.map((v) => v.message).join(" "),
            );
          }
        }

        const [row] = await tx
          .insert(visits)
          .values({
            technicianId: tech.id,
            siteId: site.id,
            startsAt: toTimestamp(date, slot.start),
            endsAt: toTimestamp(date, slot.end),
            status: cancelled ? "cancelled" : "scheduled",
            cancelledAt: cancelled ? sql`now()` : null,
          })
          .returning({ id: visits.id });

        saved.push({
          ...slot,
          id: row.id,
          status: cancelled ? "cancelled" : "scheduled",
          siteLabel: `${site.name} (${site.municipality})`,
        });
      }
    });

    console.log(
      `Datos de ejemplo cargados: ${TECHNICIANS.length} técnicos, ${SITES.length} obras y ` +
        `${VISITS.length} visitas (a partir del ${firstWorkday}).`,
    );
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
