"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { constraintViolation } from "@/db/errors";
import { getTechnicianAgenda } from "@/db/queries";
import { sites, technicians, visits } from "@/db/schema";
import {
  type RuleViolation,
  suggestStart,
  validateVisit,
  type VisitSlot,
} from "@/domain/scheduling";
import { formatMinutes, isValidDate, parseTime, toTimestamp } from "@/domain/time";

// Las Server Actions son endpoints POST accesibles sin pasar por el
// formulario, así que aquí se valida todo de nuevo, aunque el navegador ya
// haya comprobado los campos obligatorios.

const FIELDS = ["siteId", "technicianId", "date", "startTime", "durationMinutes"] as const;
export type VisitField = (typeof FIELDS)[number];
export type VisitFormValues = Record<VisitField, string>;

export interface VisitFormState {
  values: VisitFormValues;
  /** Error que no es de un campo ni de una regla (p. ej., la visita ya no existe). */
  formError?: string;
  fieldErrors?: Partial<Record<VisitField, string>>;
  violations?: RuleViolation[];
  /** Hora libre más cercana ese día ("HH:MM"), o null si no cabe en ningún hueco. */
  suggestedStartTime?: string | null;
}

const visitSchema = z.object({
  siteId: z.coerce.number("Elige una obra.").int("Elige una obra.").positive("Elige una obra."),
  technicianId: z.coerce
    .number("Elige un técnico.")
    .int("Elige un técnico.")
    .positive("Elige un técnico."),
  date: z.string().refine(isValidDate, "Indica una fecha válida."),
  startTime: z.string().refine((v) => parseTime(v) !== null, "Indica la hora en formato HH:MM."),
  // El límite superior es solo de cordura: que la visita quepa en la jornada
  // lo decide la regla c, que da un mensaje más útil.
  durationMinutes: z.coerce
    .number("La duración debe ser un número de minutos.")
    .int("La duración debe ser un número entero de minutos.")
    .min(1, "La duración debe ser de al menos 1 minuto.")
    .max(24 * 60, "La duración no puede superar un día."),
});

const visitIdSchema = z.number().int().positive();

function readValues(formData: FormData): VisitFormValues {
  return Object.fromEntries(
    FIELDS.map((field) => [field, String(formData.get(field) ?? "").trim()]),
  ) as VisitFormValues;
}

type CheckedVisit =
  | { ok: true; values: VisitFormValues; slot: VisitSlot }
  | { ok: false; state: VisitFormState };

/**
 * Valida el formulario de una visita nueva o reprogramada: formato, que
 * existan el técnico y la obra, y las tres reglas frente a la agenda del
 * técnico. Al reprogramar, `visitId` es la propia visita, que no cuenta.
 */
async function checkVisit(formData: FormData, visitId?: number): Promise<CheckedVisit> {
  const values = readValues(formData);

  const parsed = visitSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: VisitFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as VisitField;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, state: { values, fieldErrors } };
  }

  const { siteId, technicianId, date, startTime, durationMinutes } = parsed.data;

  const [technician, site] = await Promise.all([
    getDb().select({ id: technicians.id }).from(technicians).where(eq(technicians.id, technicianId)),
    getDb().select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)),
  ]);
  if (technician.length === 0 || site.length === 0) {
    return {
      ok: false,
      state: {
        values,
        fieldErrors: {
          ...(technician.length === 0 && { technicianId: "El técnico no existe." }),
          ...(site.length === 0 && { siteId: "La obra no existe." }),
        },
      },
    };
  }

  const start = parseTime(startTime)!;
  const slot = { technicianId, siteId, date, start, end: start + durationMinutes };

  const agenda = (await getTechnicianAgenda(technicianId, date)).filter(
    (visit) => visit.id !== visitId,
  );
  const violations = validateVisit(slot, agenda);
  if (violations.length > 0) {
    const suggestion = suggestStart(slot, agenda);
    return {
      ok: false,
      state: {
        values,
        violations,
        suggestedStartTime: suggestion === null ? null : formatMinutes(suggestion),
      },
    };
  }

  return { ok: true, values, slot };
}

function slotColumns(slot: VisitSlot) {
  return {
    technicianId: slot.technicianId,
    siteId: slot.siteId,
    startsAt: toTimestamp(slot.date, slot.start),
    endsAt: toTimestamp(slot.date, slot.end),
  };
}

export async function createVisit(
  _previous: VisitFormState,
  formData: FormData,
): Promise<VisitFormState> {
  const checked = await checkVisit(formData);
  if (!checked.ok) return checked.state;
  const { values, slot } = checked;

  let visitId: number;
  try {
    const [row] = await getDb()
      .insert(visits)
      .values(slotColumns(slot))
      .returning({ id: visits.id });
    visitId = row.id;
  } catch (error) {
    const violation = constraintViolation(error);
    if (violation) return { values, violations: [violation] };
    throw error;
  }

  revalidatePath("/visitas");
  redirect(`/visitas?tecnico=${slot.technicianId}&fecha=${slot.date}&creada=${visitId}`);
}

const NOT_RESCHEDULABLE = "La visita no existe o está cancelada, así que no se puede reprogramar.";

/** Cambia la obra, el técnico, el día, la hora o la duración de una visita programada. */
export async function rescheduleVisit(
  visitId: number,
  _previous: VisitFormState,
  formData: FormData,
): Promise<VisitFormState> {
  if (!visitIdSchema.safeParse(visitId).success) throw new Error("Visita no válida.");

  const [current] = await getDb()
    .select({ status: visits.status })
    .from(visits)
    .where(eq(visits.id, visitId));
  if (current?.status !== "scheduled") {
    return { values: readValues(formData), formError: NOT_RESCHEDULABLE };
  }

  const checked = await checkVisit(formData, visitId);
  if (!checked.ok) return checked.state;
  const { values, slot } = checked;

  try {
    // Las restricciones de la base de datos no comparan la fila consigo
    // misma, así que la visita puede moverse dentro de su propio horario.
    const updated = await getDb()
      .update(visits)
      .set(slotColumns(slot))
      .where(and(eq(visits.id, visitId), eq(visits.status, "scheduled")))
      .returning({ id: visits.id });
    if (updated.length === 0) return { values, formError: NOT_RESCHEDULABLE };
  } catch (error) {
    const violation = constraintViolation(error);
    if (violation) return { values, violations: [violation] };
    throw error;
  }

  revalidatePath("/visitas");
  redirect(`/visitas?tecnico=${slot.technicianId}&fecha=${slot.date}&reprogramada=${visitId}`);
}

export async function cancelVisit(visitId: number): Promise<{ error?: string }> {
  const id = visitIdSchema.safeParse(visitId);
  if (!id.success) return { error: "Visita no válida." };

  const updated = await getDb()
    .update(visits)
    .set({ status: "cancelled", cancelledAt: sql`now()` })
    .where(and(eq(visits.id, id.data), eq(visits.status, "scheduled")))
    .returning({ id: visits.id });

  if (updated.length === 0) return { error: "La visita no existe o ya estaba cancelada." };

  refresh();
  return {};
}
