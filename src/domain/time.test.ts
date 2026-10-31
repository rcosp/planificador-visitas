import { describe, expect, it } from "vitest";
import {
  addDays,
  formatMinutes,
  fromTimestamp,
  isValidDate,
  parseTime,
  toTimestamp,
} from "./time";

describe("parseTime / formatMinutes", () => {
  it("convierte en ambos sentidos", () => {
    expect(parseTime("09:30")).toBe(570);
    expect(formatMinutes(570)).toBe("09:30");
    expect(formatMinutes(0)).toBe("00:00");
  });

  it.each(["9:30", "24:00", "12:60", "", "12:30:00"])("rechaza %j", (value) => {
    expect(parseTime(value)).toBeNull();
  });
});

describe("isValidDate", () => {
  it("acepta fechas reales y rechaza las imposibles", () => {
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("03/11/2026")).toBe(false);
  });
});

describe("timestamps", () => {
  it("construye y lee el formato de PostgreSQL", () => {
    expect(toTimestamp("2026-11-03", 570)).toBe("2026-11-03 09:30:00");
    expect(fromTimestamp("2026-11-03 09:30:00")).toEqual({ date: "2026-11-03", minutes: 570 });
    expect(fromTimestamp("2026-11-03T09:30:00")).toEqual({ date: "2026-11-03", minutes: 570 });
  });

  it("suma días cruzando meses", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-02", -2)).toBe("2026-10-31");
  });
});
