// Reglas de planificación de visitas. Módulo puro: no conoce la base de datos
// ni Next.js, de modo que las reglas se pueden probar de forma aislada y son
// la única fuente de verdad para los mensajes que ve el usuario.
//
// La base de datos repite las mismas reglas como restricciones (ver la
// migración 0001) para que ni una carrera entre dos peticiones simultáneas
// pueda dejar datos inválidos.

import { formatMinutes } from "./time";

export const WORKDAY_START = 8 * 60; // 08:00
export const WORKDAY_END = 17 * 60; // 17:00
export const MIN_TRAVEL_MINUTES = 30;

export const VISIT_STATUSES = ["scheduled", "cancelled"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: "Programada",
  cancelled: "Cancelada",
};

export type RuleCode = "OVERLAP" | "TRAVEL_TIME" | "WORKING_HOURS";

export const RULE_LABELS: Record<RuleCode, string> = {
  OVERLAP: "Solape con otra visita",
  TRAVEL_TIME: "Tiempo de desplazamiento insuficiente",
  WORKING_HOURS: "Fuera de la jornada (08:00–17:00)",
};

/** Franja de una visita. `start` y `end` son minutos desde las 00:00 de `date`. */
export interface VisitSlot {
  technicianId: number;
  siteId: number;
  date: string; // YYYY-MM-DD
  start: number;
  end: number;
}

export interface ExistingVisit extends VisitSlot {
  id: number;
  status: VisitStatus;
  /** Texto para los mensajes, p. ej. "Rambla d'Ègara 120 (Terrassa)". */
  siteLabel: string;
}

export interface RuleViolation {
  rule: RuleCode;
  message: string;
  conflictingVisitId?: number;
}

/**
 * Devuelve todas las reglas que incumple `candidate` frente a las visitas ya
 * guardadas. Lista vacía = se puede guardar.
 *
 * Los intervalos son semiabiertos [inicio, fin): una visita que termina a las
 * 10:00 y otra que empieza a las 10:00 no se solapan.
 */
export function validateVisit(
  candidate: VisitSlot,
  existing: readonly ExistingVisit[],
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  if (candidate.start < WORKDAY_START || candidate.end > WORKDAY_END) {
    violations.push({
      rule: "WORKING_HOURS",
      message: workingHoursMessage(candidate),
    });
  }

  // Solo cuentan las visitas programadas del mismo técnico el mismo día: las
  // canceladas liberan el hueco y, como toda visita cabe en 08:00–17:00, entre
  // días distintos siempre hay margen de sobra para desplazarse.
  const sameAgenda = existing.filter(
    (v) =>
      v.status === "scheduled" &&
      v.technicianId === candidate.technicianId &&
      v.date === candidate.date,
  );

  for (const other of sameAgenda) {
    if (candidate.start < other.end && other.start < candidate.end) {
      violations.push({
        rule: "OVERLAP",
        message:
          `Se solapa con la visita a ${other.siteLabel} ` +
          `de ${formatMinutes(other.start)} a ${formatMinutes(other.end)}.`,
        conflictingVisitId: other.id,
      });
      continue; // un solape ya explica el conflicto con esta visita
    }

    // Se compara con todas las visitas, no solo con la anterior y la
    // siguiente, y el resultado es el mismo: entre dos visitas no contiguas en
    // obras distintas hay al menos un par contiguo en obras distintas
    // (separado >= 30 min), así que su separación es aún mayor.
    if (other.siteId === candidate.siteId) continue;

    const otherIsBefore = other.end <= candidate.start;
    const gap = otherIsBefore
      ? candidate.start - other.end
      : other.start - candidate.end;

    if (gap < MIN_TRAVEL_MINUTES) {
      violations.push({
        rule: "TRAVEL_TIME",
        message: travelMessage(candidate, other, gap, otherIsBefore),
        conflictingVisitId: other.id,
      });
    }
  }

  return violations;
}

function workingHoursMessage(candidate: VisitSlot): string {
  const parts: string[] = [];
  if (candidate.start < WORKDAY_START) {
    parts.push(`empezaría a las ${formatMinutes(candidate.start)}`);
  }
  if (candidate.end > WORKDAY_END) {
    parts.push(
      candidate.end >= 24 * 60
        ? "terminaría al día siguiente"
        : `terminaría a las ${formatMinutes(candidate.end)}`,
    );
  }
  return (
    `La visita debe empezar y terminar dentro de la jornada, ` +
    `de ${formatMinutes(WORKDAY_START)} a ${formatMinutes(WORKDAY_END)} ` +
    `(${parts.join(" y ")}).`
  );
}

function travelMessage(
  candidate: VisitSlot,
  other: ExistingVisit,
  gap: number,
  otherIsBefore: boolean,
): string {
  const detail = otherIsBefore
    ? `la visita a ${other.siteLabel} termina a las ${formatMinutes(other.end)} ` +
      `y esta empezaría a las ${formatMinutes(candidate.start)}`
    : `esta terminaría a las ${formatMinutes(candidate.end)} ` +
      `y la visita a ${other.siteLabel} empieza a las ${formatMinutes(other.start)}`;
  return (
    `Solo quedan ${gap} min para desplazarse entre obras distintas ` +
    `(mínimo ${MIN_TRAVEL_MINUTES} min): ${detail}.`
  );
}
