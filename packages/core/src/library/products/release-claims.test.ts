import { describe, expect, it } from "vitest";
import { isDateStated, isVersionStated } from "./release-claims";

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
  it.each(["en", "pt", "fr", "de", "ja"])(
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

  it.each(["en", "pt"])(
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

  it("ignores parts of a date far apart in the passage", () => {
    const date = new Date(Date.UTC(2025, 9, 21));
    const passage = "version 21 is new. It took many months of careful work before October 2025.";
    expect(isDateStated({ date, language: "en", passage })).toBe(false);
  });
});

const PRODUCT_NAMES = ["Orbit Server", "Orbit"];

/** Whether `passage` states `release`'s version, the last word of its name. */
function stated(passage: string, release = "Orbit Server 1.37"): boolean {
  const version = release.split(" ").at(-1) ?? null;
  return isVersionStated({ name: release, passage, productNames: PRODUCT_NAMES, version });
}

describe(isVersionStated, () => {
  it("accepts a version with a separator as a whole token", () => {
    expect(stated("1.37 | 1.37.2 | 2027-10-28")).toBe(true);
    expect(stated("v1.37 (stable)")).toBe(true);
    expect(stated("2025.1 LTS", "Orbit Server 2025.1")).toBe(true);
  });

  it("refuses a version that's only part of another token", () => {
    expect(stated("1.37.2 | 2027-10-28")).toBe(false);
    expect(stated("11.37 | 2027-10-28")).toBe(false);
    expect(stated("release1.37 is out")).toBe(false);
  });

  it("needs the release name for a bare integer or a single character", () => {
    expect(stated("5 | 2025-10-21 | supported", "Orbit Notes 5")).toBe(false);
    expect(stated("16 | 2026-01-02", "Orbit Notes 16")).toBe(false);
  });

  it("refuses a version the release's own name doesn't carry", () => {
    expect(
      isVersionStated({
        name: "Orbit Server 1.38",
        passage: "1.37 | 2027-10-28",
        productNames: PRODUCT_NAMES,
        version: "1.37",
      }),
    ).toBe(false);
  });

  it("accepts a version that opens its line after list marks and a release word", () => {
    expect(stated("## 1.37  November 3, 2026")).toBe(true);
    expect(stated("- Release 1.36\n- Release 1.37")).toBe(true);
    expect(stated("Version: v1.37")).toBe(true);
    expect(stated("Versão 1.37 - outubro de 2026")).toBe(true);
    expect(stated("- Release anterior: Release 1.37 - Expedição em Outubro/2026")).toBe(true);
    expect(stated("Latest release: 1.37")).toBe(true);
  });

  it("accepts a version right beside the product's name or an alias", () => {
    expect(stated("Orbit Server | 1.37 | 2027-10-28")).toBe(true);
    expect(stated("Orbit 1.37 shipped with faster sync.")).toBe(true);
    expect(stated("See the schedule for the upcoming 1.37 Orbit Server release!")).toBe(true);
  });

  it("refuses a version that follows any other name", () => {
    expect(stated("Comet Phone 1.37 released on 2026-09-15.")).toBe(false);
    expect(stated("Comet Phone release 1.37")).toBe(false);
    expect(stated("Latest: v1.37 (stable)")).toBe(false);
    expect(stated("Comet Phone release: 1.37")).toBe(false);
    expect(stated("Neworbit 1.37")).toBe(false);
    expect(stated("the upcoming 1.37 Orbiter release")).toBe(false);
    expect(stated("Comet Phone 1.37 | Orbit Server 1.36")).toBe(false);
  });
});
