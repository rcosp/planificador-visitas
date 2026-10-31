import { isValidDate } from "@/domain/time";

type SearchParamValue = string | string[] | undefined;

/** Primer valor de un parámetro de la URL (puede venir repetido). */
function single(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseIdParam(value: SearchParamValue): number | undefined {
  const raw = single(value);
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const id = Number(raw);
  return id > 0 ? id : undefined;
}

export function parseDateParam(value: SearchParamValue): string | undefined {
  const raw = single(value);
  return raw && isValidDate(raw) ? raw : undefined;
}
