import { describe, expect, it } from "vitest";
import { parseLocalDate, serializeDate } from "./date";

describe(parseLocalDate, () => {
  it("parses a valid YYYY-MM-DD string to UTC midnight", () => {
    const result = parseLocalDate("2026-03-15");
    expect(result).toStrictEqual(new Date(Date.UTC(2026, 2, 15)));
  });

  it("returns UTC midnight (hours/minutes/seconds are zero)", () => {
    const result = parseLocalDate("2026-06-01");
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });

  it("handles January correctly (month offset)", () => {
    const result = parseLocalDate("2026-01-05");
    expect(result).toStrictEqual(new Date(Date.UTC(2026, 0, 5)));
  });

  it("handles December correctly", () => {
    const result = parseLocalDate("2026-12-31");
    expect(result).toStrictEqual(new Date(Date.UTC(2026, 11, 31)));
  });

  it("handles leap day", () => {
    const result = parseLocalDate("2028-02-29");
    expect(result).toStrictEqual(new Date(Date.UTC(2028, 1, 29)));
  });
});

describe(serializeDate, () => {
  it("serializes Date objects as ISO strings", () => {
    const value = new Date("2026-05-04T12:30:00.000Z");

    expect(serializeDate(value)).toBe("2026-05-04T12:30:00.000Z");
  });

  it("returns existing strings without changing them", () => {
    expect(serializeDate("2026-05-04T12:30:00.000Z")).toBe("2026-05-04T12:30:00.000Z");
  });

  it("returns null for missing values", () => {
    expect(serializeDate(null)).toBeNull();
    expect(serializeDate()).toBeNull();
  });
});
