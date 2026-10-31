import { describe, expect, it } from "vitest";
import {
  type ExistingVisit,
  type RuleCode,
  type VisitSlot,
  validateVisit,
} from "./scheduling";
import { parseTime } from "./time";

const DATE = "2026-11-03";
const TECH = 1;
const SITE_A = 10;
const SITE_B = 20;

function t(hhmm: string): number {
  const minutes = parseTime(hhmm);
  if (minutes === null) throw new Error(`hora inválida en el test: ${hhmm}`);
  return minutes;
}

function slot(from: string, to: string, overrides: Partial<VisitSlot> = {}): VisitSlot {
  return { technicianId: TECH, siteId: SITE_A, date: DATE, start: t(from), end: t(to), ...overrides };
}

let nextId = 1;
function visit(from: string, to: string, overrides: Partial<ExistingVisit> = {}): ExistingVisit {
  const id = nextId++;
  return {
    ...slot(from, to),
    id,
    status: "scheduled",
    siteLabel: `Obra ${overrides.siteId ?? SITE_A}`,
    ...overrides,
  };
}

function rules(candidate: VisitSlot, existing: ExistingVisit[] = []): RuleCode[] {
  return validateVisit(candidate, existing).map((v) => v.rule);
}

describe("regla c: jornada 08:00–17:00", () => {
  it("acepta una visita que ocupa la jornada completa", () => {
    expect(rules(slot("08:00", "17:00"))).toEqual([]);
  });

  it("rechaza empezar antes de las 08:00", () => {
    expect(rules(slot("07:59", "09:00"))).toEqual(["WORKING_HOURS"]);
  });

  it("rechaza terminar después de las 17:00 e indica a qué hora terminaría", () => {
    const [violation] = validateVisit(slot("16:30", "17:30"), []);
    expect(violation.rule).toBe("WORKING_HOURS");
    expect(violation.message).toContain("terminaría a las 17:30");
  });

  it("rechaza terminar a las 17:01", () => {
    expect(rules(slot("16:00", "17:01"))).toEqual(["WORKING_HOURS"]);
  });

  it("rechaza una visita que acabaría al día siguiente", () => {
    const candidate = { ...slot("16:00", "17:00"), end: t("16:00") + 10 * 60 };
    const [violation] = validateVisit(candidate, []);
    expect(violation.rule).toBe("WORKING_HOURS");
    expect(violation.message).toContain("terminaría al día siguiente");
  });
});

describe("regla a: sin solapes", () => {
  const existing = visit("10:00", "11:00");

  it.each([
    ["solape por delante", "09:30", "10:30"],
    ["solape por detrás", "10:30", "11:30"],
    ["contenida en la existente", "10:15", "10:45"],
    ["contiene a la existente", "09:00", "12:00"],
    ["idéntica", "10:00", "11:00"],
  ])("rechaza %s", (_, from, to) => {
    expect(rules(slot(from, to), [existing])).toEqual(["OVERLAP"]);
  });

  it("acepta visitas contiguas en la misma obra (sin hueco)", () => {
    expect(rules(slot("11:00", "12:00"), [existing])).toEqual([]);
    expect(rules(slot("09:00", "10:00"), [existing])).toEqual([]);
  });

  it("con obra distinta informa solo del solape, no también del desplazamiento", () => {
    expect(rules(slot("10:30", "11:30", { siteId: SITE_B }), [existing])).toEqual(["OVERLAP"]);
  });

  it("identifica la visita con la que se solapa", () => {
    const [violation] = validateVisit(slot("10:30", "11:30"), [existing]);
    expect(violation.conflictingVisitId).toBe(existing.id);
    expect(violation.message).toContain("de 10:00 a 11:00");
  });
});

describe("regla b: 30 min de desplazamiento entre obras distintas", () => {
  const existing = visit("10:00", "11:00", { siteId: SITE_A });
  const otherSite = { siteId: SITE_B };

  it("rechaza 29 min después de una visita en otra obra", () => {
    const [violation] = validateVisit(slot("11:29", "12:00", otherSite), [existing]);
    expect(violation.rule).toBe("TRAVEL_TIME");
    expect(violation.message).toContain("Solo quedan 29 min");
  });

  it("rechaza 29 min antes de una visita en otra obra", () => {
    expect(rules(slot("09:00", "09:31", otherSite), [existing])).toEqual(["TRAVEL_TIME"]);
  });

  it("rechaza visitas contiguas en obras distintas", () => {
    expect(rules(slot("11:00", "12:00", otherSite), [existing])).toEqual(["TRAVEL_TIME"]);
  });

  it("acepta exactamente 30 min antes y después", () => {
    expect(rules(slot("11:30", "12:00", otherSite), [existing])).toEqual([]);
    expect(rules(slot("09:00", "09:30", otherSite), [existing])).toEqual([]);
  });

  it("no exige desplazamiento dentro de la misma obra", () => {
    expect(rules(slot("11:10", "12:00"), [existing])).toEqual([]);
  });
});

describe("visitas que no cuentan", () => {
  it("ignora las visitas canceladas: liberan el hueco", () => {
    const cancelled = visit("10:00", "11:00", { status: "cancelled" });
    expect(rules(slot("10:00", "11:00", { siteId: SITE_B }), [cancelled])).toEqual([]);
  });

  it("ignora las visitas de otros técnicos", () => {
    const otherTech = visit("10:00", "11:00", { technicianId: 2 });
    expect(rules(slot("10:00", "11:00"), [otherTech])).toEqual([]);
  });

  it("ignora las visitas de otros días", () => {
    const otherDay = visit("10:00", "11:00", { date: "2026-11-04" });
    expect(rules(slot("10:00", "11:00"), [otherDay])).toEqual([]);
  });
});

describe("varias reglas a la vez", () => {
  it("devuelve todas las reglas incumplidas con la visita en conflicto", () => {
    const overlapping = visit("15:00", "16:30", { siteId: SITE_A });
    const farEnough = visit("14:00", "14:45", { siteId: SITE_B });
    const violations = validateVisit(slot("16:00", "17:30", { siteId: SITE_A }), [
      overlapping,
      farEnough,
    ]);

    expect(violations.map((v) => v.rule)).toEqual(["WORKING_HOURS", "OVERLAP"]);
    expect(violations[1].conflictingVisitId).toBe(overlapping.id);
  });

  it("detecta solape con una visita y falta de desplazamiento con otra", () => {
    const overlapping = visit("09:00", "10:00", { siteId: SITE_A });
    const tooClose = visit("11:15", "12:00", { siteId: SITE_B });
    const violations = validateVisit(slot("09:30", "11:00", { siteId: SITE_A }), [
      overlapping,
      tooClose,
    ]);

    expect(violations.map((v) => [v.rule, v.conflictingVisitId])).toEqual([
      ["OVERLAP", overlapping.id],
      ["TRAVEL_TIME", tooClose.id],
    ]);
  });
});
