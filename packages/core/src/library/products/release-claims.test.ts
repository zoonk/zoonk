import { describe, expect, it } from "vitest";
import { isDateStated, isMonthStated, isVersionStated } from "./release-claims";

const DAYS = 731;
const MS_PER_DAY = 86_400_000;
const START = Date.UTC(2024, 0, 1);

function listDates(): Date[] {
  return Array.from({ length: DAYS }, (_, index) => new Date(START + index * MS_PER_DAY));
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function formatLong({ date, language }: { date: Date; language: string }): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(date);
}

describe(isDateStated, () => {
  it.each(["en", "pt", "fr", "de", "ja", "pl", "ru", "fi"])(
    "finds every date its page's %s formats state",
    (language) => {
      const missed = listDates().filter(
        (date) =>
          !isDateStated({ date, language, passage: formatLong({ date, language }) }) ||
          !isDateStated({ date, language, passage: date.toISOString().slice(0, 10) }),
      );

      expect(missed).toStrictEqual([]);
    },
  );

  it.each(["en", "pt", "pl", "ru", "fi"])(
    "never confirms a date from a passage with another day or month (%s)",
    (language) => {
      const confirmed = listDates().filter((date) =>
        [1, -1, 31, -30].some((days) => {
          const other = shiftDays(date, days);

          return (
            isDateStated({ date, language, passage: formatLong({ date: other, language }) }) ||
            isDateStated({ date, language, passage: other.toISOString().slice(0, 10) })
          );
        }),
      );

      expect(confirmed).toStrictEqual([]);
    },
  );

  it("reads the month in the form a language writes it inside a date", () => {
    const date = new Date(Date.UTC(2024, 4, 4));

    expect(
      [
        ["pl", "Wydano 4 maja 2024"],
        ["ru", "Выпущено 4 мая 2024 г."],
        ["fi", "Julkaistu 4. toukokuuta 2024"],
      ].filter(([language = "", passage = ""]) => !isDateStated({ date, language, passage })),
    ).toStrictEqual([]);
  });

  it("needs the day, not only the month and year", () => {
    const date = new Date(Date.UTC(2024, 4, 1));

    expect(
      isDateStated({ date, language: "en", passage: "Orbit Notes 4 shipped in May 2024." }),
    ).toBe(false);
  });

  it("reads a numeric date only when it can't be read with day and month swapped", () => {
    const october = new Date(Date.UTC(2025, 9, 5));
    const may = new Date(Date.UTC(2025, 4, 10));

    expect(isDateStated({ date: october, language: "pt", passage: "em 05/10/2025" })).toBe(false);
    expect(isDateStated({ date: may, language: "pt", passage: "em 05/10/2025" })).toBe(false);
    expect(isDateStated({ date: october, language: "pt", passage: "em 2025/10/05" })).toBe(true);

    expect(
      isDateStated({
        date: new Date(Date.UTC(2025, 9, 21)),
        language: "de",
        passage: "21.10.2025",
      }),
    ).toBe(true);
  });

  it("doesn't read one number as both the day and the month", () => {
    const date = new Date(Date.UTC(2025, 9, 10));
    expect(isDateStated({ date, language: "en", passage: "released 10/2025" })).toBe(false);
  });

  it("never takes a release number beside the month and year for the day", () => {
    const date = new Date(Date.UTC(2024, 4, 4));

    const confirmed = [
      "Orbit Notes 4 shipped in May 2024.",
      "| Orbit Notes 4 | May 2024 |",
      "Orbit Notes 4 - May 2024",
      "Orbit Notes 4: May 2024",
      "Orbit Notes 4\nMay 2024",
    ].filter((passage) => isDateStated({ date, language: "en", passage }));

    expect(confirmed).toStrictEqual([]);
  });

  it("reads a day written in the date's own expression", () => {
    const date = new Date(Date.UTC(2024, 4, 4));

    const missed = [
      "May 4th, 2024",
      "the 4th of May 2024",
      "Tuesday, 4 May 2024",
      "4-May-2024",
      "2024/05/04",
      "Orbit Notes 5 shipped on May 4, 2024",
    ].filter((passage) => !isDateStated({ date, language: "en", passage }));

    expect(missed).toStrictEqual([]);
  });

  it("ignores parts of a date far apart in the passage", () => {
    const date = new Date(Date.UTC(2025, 9, 21));
    const passage = "version 21 is new. It took many months of careful work before October 2025.";
    expect(isDateStated({ date, language: "en", passage })).toBe(false);
  });
});

describe(isMonthStated, () => {
  const october = new Date(Date.UTC(2024, 9, 1));

  it("finds a month and year stated together", () => {
    const missed = [
      ["pt", "Orbit 5 - Expedição em Outubro/2024"],
      ["pt", "lançado em outubro de 2024"],
      ["en", "Orbit Notes 4 shipped in October 2024."],
      ["en", "Oct 2024"],
      ["en", "2024-10"],
      ["en", "10/2024"],
      ["ja", "2024年10月"],
      ["pl", "Wydanie: październik 2024 r."],
      ["pl", "4 października 2024"],
      ["ru", "4 октября 2024 г."],
      ["fi", "4. lokakuuta 2024"],
    ].filter(
      ([language = "", passage = ""]) => !isMonthStated({ date: october, language, passage }),
    );

    expect(missed).toStrictEqual([]);
  });

  it("refuses a year alone, another month, a version, or a month and year apart", () => {
    const confirmed = [
      "Orbit Notes 4 shipped in 2024.",
      "September 2024",
      "Orbit Notes 10 2024",
      "Orbit 2024.10",
      "October was busy. In 2024 we shipped it.",
    ].filter((passage) => isMonthStated({ date: october, language: "en", passage }));

    expect(confirmed).toStrictEqual([]);
  });
});

describe(isVersionStated, () => {
  const name = "Orbit Server 1.37";

  it("accepts a version with a separator as a whole token", () => {
    expect(isVersionStated({ name, passage: "1.37 | 1.37.2 | 2027-10-28", version: "1.37" })).toBe(
      true,
    );

    expect(isVersionStated({ name, passage: "## v1.37 (stable)", version: "1.37" })).toBe(true);

    expect(
      isVersionStated({ name: "Orbit Server 2025.1", passage: "2025.1 LTS", version: "2025.1" }),
    ).toBe(true);
  });

  it("refuses a version that's only part of another token", () => {
    expect(isVersionStated({ name, passage: "1.37.2 | 2027-10-28", version: "1.37" })).toBe(false);
    expect(isVersionStated({ name, passage: "11.37 | 2027-10-28", version: "1.37" })).toBe(false);
    expect(isVersionStated({ name, passage: "release1.37 is out", version: "1.37" })).toBe(false);
  });

  it("needs the release name for a bare integer or a single character", () => {
    const short = { name: "Orbit Notes 5", passage: "5 | 2025-10-21 | supported" };

    expect(isVersionStated({ ...short, version: "5" })).toBe(false);

    expect(
      isVersionStated({ name: "Orbit Notes 16", passage: "16 | 2026-01-02", version: "16" }),
    ).toBe(false);
  });

  it("refuses a version the release's own name doesn't carry", () => {
    expect(
      isVersionStated({ name: "Orbit Server 1.38", passage: "1.37 | 2027-10-28", version: "1.37" }),
    ).toBe(false);
  });
});
