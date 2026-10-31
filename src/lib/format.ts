import { formatMinutes, fromTimestamp } from "@/domain/time";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC", // la fecha ya es local; UTC solo evita que se desplace
});

/** "2026-11-03" -> "mar, 03/11/2026". */
export function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

/** 90 -> "1 h 30 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Fecha, horas y duración de una visita a partir de sus timestamps. */
export function describeSlot(startsAt: string, endsAt: string) {
  const start = fromTimestamp(startsAt);
  const end = fromTimestamp(endsAt);
  return {
    date: start.date,
    dateLabel: formatDate(start.date),
    timeLabel: `${formatMinutes(start.minutes)}–${formatMinutes(end.minutes)}`,
    durationLabel: formatDuration(end.minutes - start.minutes),
  };
}
