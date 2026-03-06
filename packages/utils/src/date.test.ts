import { describe, expect, it } from "vitest";
import { parseLocalDate } from "./date";

describe(parseLocalDate, () => {
  it("parses a valid YYYY-MM-DD string to UTC midnight", () => {
    const result = parseLocalDate("2026-03-15");
    expect(result).toEqual(new Date(Date.UTC(2026, 2, 15)));
  });

  it("returns UTC midnight (hours/minutes/seconds are zero)", () => {
    const result = parseLocalDate("2026-06-01");
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });

  it("handles January correctly (month offset)", () => {
    const result = parseLocalDate("2026-01-05");
    expect(result).toEqual(new Date(Date.UTC(2026, 0, 5)));
  });

  it("handles December correctly", () => {
    const result = parseLocalDate("2026-12-31");
    expect(result).toEqual(new Date(Date.UTC(2026, 11, 31)));
  });

  it("handles leap day", () => {
    const result = parseLocalDate("2028-02-29");
    expect(result).toEqual(new Date(Date.UTC(2028, 1, 29)));
  });
});
