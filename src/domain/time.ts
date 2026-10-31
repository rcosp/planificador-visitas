// Utilidades de hora "de pared". Toda la app trabaja en hora local de la
// empresa (una sola zona horaria), así que las horas se manejan como minutos
// desde las 00:00 y las fechas como texto YYYY-MM-DD, sin objetos Date.

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/;

/** "09:30" -> 570. Devuelve null si el formato no es HH:MM válido. */
export function parseTime(value: string): number | null {
  const match = TIME_RE.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 570 -> "09:30". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Comprueba que sea una fecha de calendario real (rechaza 2026-02-30). */
export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** ("2026-11-03", 570) -> "2026-11-03 09:30:00", formato de `timestamp` en PostgreSQL. */
export function toTimestamp(date: string, minutes: number): string {
  return `${date} ${formatMinutes(minutes)}:00`;
}

/** "2026-11-03 09:30:00" -> { date: "2026-11-03", minutes: 570 }. */
export function fromTimestamp(value: string): { date: string; minutes: number } {
  const match = TIMESTAMP_RE.exec(value);
  if (!match) throw new Error(`Timestamp con formato inesperado: ${value}`);
  return { date: match[1], minutes: Number(match[2]) * 60 + Number(match[3]) };
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
