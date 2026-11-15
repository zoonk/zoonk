import { describe, expect, it } from "vitest";
import { formatIsoDate, formatIsoDateRange } from "./date-format";

const today = "2026-11-15";

function inEnglish(
  isoDate: string,
  options: Omit<Parameters<typeof formatIsoDate>[0], "isoDate" | "locale" | "today"> = {},
) {
  return formatIsoDate({ isoDate, locale: "en", today, ...options });
}

describe(formatIsoDate, () => {
  it("writes a data row's date short and a sentence's date whole", () => {
    expect(inEnglish("2026-12-14")).toBe("Dec 14");
    expect(inEnglish("2026-12-14", { role: "sentence" })).toBe("December 14");
  });

  it.each([
    { expected: "Jan 14, 2027", role: "row" },
    { expected: "January 14, 2027", role: "sentence" },
    { expected: "Jan 2027", role: "rowMonth" },
    { expected: "January 2027", role: "sentenceMonth" },
  ] as const)("names the year of a $role date in another year", ({ expected, role }) => {
    expect(inEnglish("2027-01-14", { role })).toBe(expected);
  });

  it("leaves the year out of a month this year", () => {
    expect(inEnglish("2026-12-02", { role: "rowMonth" })).toBe("Dec");
    expect(inEnglish("2026-12-02", { role: "sentenceMonth" })).toBe("December");
  });

  it("writes a day with its weekday one way in a row and one way in a sentence", () => {
    expect(inEnglish("2026-11-17", { weekday: true })).toBe("Tue, Nov 17");

    expect(inEnglish("2026-11-17", { role: "sentence", weekday: true })).toBe(
      "Tuesday, November 17",
    );

    expect(inEnglish("2027-01-04", { role: "sentence", weekday: true })).toBe(
      "Monday, January 4, 2027",
    );
  });

  it("shows or hides the year when the place asks for it", () => {
    expect(inEnglish("2026-12-14", { year: "always" })).toBe("Dec 14, 2026");
    expect(inEnglish("2027-01-14", { role: "sentence", year: "never" })).toBe("January 14");

    expect(inEnglish("2026-12-02", { role: "sentenceMonth", year: "always" })).toBe(
      "December 2026",
    );
  });

  it("names a weekday alone, with no year in any year", () => {
    expect(inEnglish("2027-01-04", { role: "weekday" })).toBe("Monday");
  });

  it("writes in the language's own order, Mexico's for Spanish", () => {
    expect(formatIsoDate({ isoDate: "2027-11-14", locale: "pt", today })).toBe(
      "14 de nov. de 2027",
    );

    expect(formatIsoDate({ isoDate: "2026-12-14", locale: "es", role: "sentence", today })).toBe(
      "14 de diciembre",
    );
  });
});

function week({ end, start, on }: { end: string; on: string; start: string }) {
  return formatIsoDateRange({ end, locale: "en", start, today: on }).replaceAll("\u2009", " ");
}

describe(formatIsoDateRange, () => {
  it("names the year of a week last year", () => {
    expect(week({ end: "2026-12-27", on: "2027-01-01", start: "2026-12-21" })).toBe(
      "Dec 21 – 27, 2026",
    );
  });

  it("names both years of a week across New Year", () => {
    expect(week({ end: "2027-01-03", on: "2027-01-04", start: "2026-12-28" })).toBe(
      "Dec 28, 2026 – Jan 3, 2027",
    );
  });

  it("leaves the year out of a week this year", () => {
    expect(week({ end: "2026-11-08", on: "2026-11-14", start: "2026-11-02" })).toBe("Nov 2 – 8");
  });
});
