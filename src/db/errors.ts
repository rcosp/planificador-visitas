import { RULE_LABELS, type RuleCode, type RuleViolation } from "@/domain/scheduling";

// Nombres de las restricciones de drizzle/0001_reglas_planificacion.sql.
const CONSTRAINT_RULES: Record<string, RuleCode> = {
  visits_no_overlap: "OVERLAP",
  visits_travel_time: "TRAVEL_TIME",
  visits_working_hours_check: "WORKING_HOURS",
};

/**
 * Si la base de datos ha rechazado la visita por una de las reglas, la
 * traduce. Solo ocurre si otra visita del mismo técnico se ha guardado entre
 * la validación y la inserción. Drizzle envuelve el error de `pg` en `cause`.
 */
export function constraintViolation(error: unknown): RuleViolation | null {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    const constraint = (e as { constraint?: string }).constraint;
    const rule = constraint ? CONSTRAINT_RULES[constraint] : undefined;
    if (rule) {
      return {
        rule,
        message:
          `${RULE_LABELS[rule]}: se acaba de guardar otra visita del técnico que lo impide. ` +
          "Revisa su agenda y vuelve a intentarlo.",
      };
    }
  }
  return null;
}
