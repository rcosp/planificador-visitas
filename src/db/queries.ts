import { and, asc, eq, gte, lt } from "drizzle-orm";
import { connection } from "next/server";
import type { ExistingVisit } from "@/domain/scheduling";
import { addDays, fromTimestamp } from "@/domain/time";
import { getDb } from "./client";
import { sites, technicians, visits } from "./schema";

// Las funciones de lectura que usan las páginas llaman a connection(): los
// datos cambian con cada visita, así que se leen siempre en la petición y no
// durante el prerenderizado del build.

export async function listTechnicians() {
  await connection();
  return getDb().select().from(technicians).orderBy(asc(technicians.name));
}

export async function listSites() {
  await connection();
  return getDb().select().from(sites).orderBy(asc(sites.municipality), asc(sites.name));
}

export interface VisitFilters {
  technicianId?: number;
  date?: string; // YYYY-MM-DD
}

export type VisitRow = Awaited<ReturnType<typeof listVisits>>[number];

export async function listVisits({ technicianId, date }: VisitFilters) {
  await connection();
  return getDb()
    .select({
      id: visits.id,
      startsAt: visits.startsAt,
      endsAt: visits.endsAt,
      status: visits.status,
      technicianId: visits.technicianId,
      technicianName: technicians.name,
      siteName: sites.name,
      municipality: sites.municipality,
    })
    .from(visits)
    .innerJoin(technicians, eq(visits.technicianId, technicians.id))
    .innerJoin(sites, eq(visits.siteId, sites.id))
    .where(
      and(
        technicianId ? eq(visits.technicianId, technicianId) : undefined,
        ...(date ? dayRange(date) : []),
      ),
    )
    .orderBy(asc(visits.startsAt), asc(technicians.name));
}

/** Una visita con los nombres del técnico y la obra, o null si no existe. */
export async function getVisit(id: number) {
  await connection();
  const [row] = await getDb()
    .select({
      id: visits.id,
      technicianId: visits.technicianId,
      siteId: visits.siteId,
      startsAt: visits.startsAt,
      endsAt: visits.endsAt,
      status: visits.status,
      technicianName: technicians.name,
      siteName: sites.name,
      municipality: sites.municipality,
    })
    .from(visits)
    .innerJoin(technicians, eq(visits.technicianId, technicians.id))
    .innerJoin(sites, eq(visits.siteId, sites.id))
    .where(eq(visits.id, id));
  return row ?? null;
}

/** Primer día posterior a `date` con alguna visita programada, o null si no hay. */
export async function findNextVisitDate(date: string): Promise<string | null> {
  await connection();
  const [row] = await getDb()
    .select({ startsAt: visits.startsAt })
    .from(visits)
    .where(
      and(eq(visits.status, "scheduled"), gte(visits.startsAt, `${addDays(date, 1)} 00:00:00`)),
    )
    .orderBy(asc(visits.startsAt))
    .limit(1);
  return row ? fromTimestamp(row.startsAt).date : null;
}

/** Visitas de un técnico en un día, en el formato que esperan las reglas. */
export async function getTechnicianAgenda(
  technicianId: number,
  date: string,
): Promise<ExistingVisit[]> {
  const rows = await getDb()
    .select({
      id: visits.id,
      technicianId: visits.technicianId,
      siteId: visits.siteId,
      startsAt: visits.startsAt,
      endsAt: visits.endsAt,
      status: visits.status,
      siteName: sites.name,
      municipality: sites.municipality,
    })
    .from(visits)
    .innerJoin(sites, eq(visits.siteId, sites.id))
    .where(and(eq(visits.technicianId, technicianId), ...dayRange(date)));

  return rows.map((row) => ({
    id: row.id,
    technicianId: row.technicianId,
    siteId: row.siteId,
    status: row.status,
    date,
    start: fromTimestamp(row.startsAt).minutes,
    end: fromTimestamp(row.endsAt).minutes,
    siteLabel: `${row.siteName} (${row.municipality})`,
  }));
}

function dayRange(date: string) {
  return [
    gte(visits.startsAt, `${date} 00:00:00`),
    lt(visits.startsAt, `${addDays(date, 1)} 00:00:00`),
  ];
}
