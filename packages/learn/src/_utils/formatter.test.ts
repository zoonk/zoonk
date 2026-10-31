import { describe, expect, it } from "vitest";
import { getLocaleFormatter } from "./formatter";

describe(getLocaleFormatter, () => {
  it("formats Spanish numbers and times the Mexican way", () => {
    const format = getLocaleFormatter({ locale: "es", timeZone: "UTC" });

    expect(format.number(1234.5)).toBe("1,234.5");

    expect(format.dateTime(new Date("2026-09-27T14:30:00Z"), { timeStyle: "short" })).toBe(
      "2:30 p.m.",
    );
  });

  it("keeps each time zone's dates apart", () => {
    const day = new Date("2026-09-27T02:00:00Z");

    expect(
      getLocaleFormatter({ locale: "en", timeZone: "UTC" }).dateTime(day, { day: "numeric" }),
    ).toBe("27");

    expect(
      getLocaleFormatter({ locale: "en", timeZone: "America/Mexico_City" }).dateTime(day, {
        day: "numeric",
      }),
    ).toBe("26");
  });
});
