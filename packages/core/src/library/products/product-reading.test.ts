import {
  type ProductReading,
  type ProductReleaseClaim,
} from "@zoonk/ai/tasks/research/read-product-pages";
import { describe, expect, it } from "vitest";
import { isPassageInDocument } from "../exams/passage-check";
import { checkProductReading, isDateStated } from "./product-reading";

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

const PAGE = `Orbit Notes is made by Lumen Works.
Orbit Notes 5 shipped on October 21st, 2025 with offline sync. Support for Orbit Notes 3 ends on 2026-03-31.
Orbit Notes 4 shipped in May 2024.`;

const PT_PAGE = "O Orbit Notes 5 foi lançado em 21 de outubro de 2025 para todos.";

function release(overrides: Partial<ProductReleaseClaim> = {}): ProductReleaseClaim {
  return {
    document: 1,
    name: "Orbit Notes 5",
    passage: "Orbit Notes 5 shipped on October 21st, 2025",
    releasedOn: "2025-10-21",
    supportEndsOn: null,
    version: "5",
    ...overrides,
  };
}

const PRODUCT = {
  aliases: [],
  description: "A note-taking app.",
  document: 1,
  name: "Orbit Notes",
  passage: "Orbit Notes is made by Lumen Works.",
};

function reading(overrides: Partial<ProductReading> = {}): ProductReading {
  return {
    brand: {
      description: "A software company.",
      document: 1,
      name: "Lumen Works",
      passage: "Orbit Notes is made by Lumen Works.",
    },
    learnerRelease: null,
    product: PRODUCT,
    releases: [release()],
    ...overrides,
  };
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

describe(checkProductReading, () => {
  const pages = [{ language: "en", text: PAGE }];

  it("keeps claims whose passages the page states word for word", () => {
    const checked = checkProductReading({ pages, reading: reading() });

    expect(checked.brand?.name).toBe("Lumen Works");
    expect(checked.product?.name).toBe("Orbit Notes");

    expect(checked.releases).toStrictEqual([
      {
        document: 1,
        name: "Orbit Notes 5",
        passage: "Orbit Notes 5 shipped on October 21st, 2025",
        releasedAt: new Date(Date.UTC(2025, 9, 21)),
        supportEndsAt: null,
        version: "5",
      },
    ]);
  });

  it("drops a release whose passage differs from the page by one word", () => {
    const checked = checkProductReading({
      pages,
      reading: reading({
        releases: [
          release({ passage: "Orbit Notes 5 shipped on October 21st, 2025 with online sync" }),
        ],
      }),
    });

    expect(checked.releases).toStrictEqual([]);

    expect(
      isPassageInDocument({
        passage: "Orbit Notes 5 shipped on October 21st, 2025 with online sync",
        text: PAGE,
      }),
    ).toBe(true);
  });

  it("drops a release whose passage names another release", () => {
    const checked = checkProductReading({
      pages,
      reading: reading({ releases: [release({ name: "Orbit Notes 6" })] }),
    });

    expect(checked.releases).toStrictEqual([]);
  });

  it("keeps a release with an unknown date when its passage doesn't state the claimed one", () => {
    const checked = checkProductReading({
      pages,
      reading: reading({
        releases: [
          release({
            name: "Orbit Notes 4",
            passage: "Orbit Notes 4 shipped in May 2024.",
            releasedOn: "2024-05-14",
          }),
        ],
      }),
    });

    expect(checked.releases[0]?.releasedAt).toBeNull();
  });

  it("drops an invalid calendar date", () => {
    const checked = checkProductReading({
      pages,
      reading: reading({ releases: [release({ releasedOn: "2025-02-30" })] }),
    });

    expect(checked.releases[0]?.releasedAt).toBeNull();
  });

  it("reads a date in the page's language", () => {
    const checked = checkProductReading({
      pages: [{ language: "pt", text: PT_PAGE }],
      reading: reading({
        brand: null,
        product: null,
        releases: [release({ passage: "Orbit Notes 5 foi lançado em 21 de outubro de 2025" })],
      }),
    });

    expect(checked.releases[0]?.releasedAt).toStrictEqual(new Date(Date.UTC(2025, 9, 21)));
  });

  it("drops a brand or product the cited page doesn't hold, or a page that doesn't exist", () => {
    const checked = checkProductReading({
      pages,
      reading: reading({
        brand: {
          description: "",
          document: 1,
          name: "Lumen Works",
          passage: "Made by Lumen Works Inc.",
        },
        product: {
          aliases: [],
          description: "",
          document: 2,
          name: "Orbit Notes",
          passage: "Orbit Notes is made by Lumen Works.",
        },
      }),
    });

    expect(checked.brand).toBeNull();
    expect(checked.product).toBeNull();
  });

  it("keeps only aliases the pages use", () => {
    const checked = checkProductReading({
      pages,
      reading: reading({ product: { ...PRODUCT, aliases: ["Orbit", "Orbit Pad"] } }),
    });

    expect(checked.product?.aliases).toStrictEqual(["Orbit"]);
  });

  it("keeps the learner's release only when it's among the kept releases", () => {
    expect(
      checkProductReading({ pages, reading: reading({ learnerRelease: "Orbit Notes 5" }) })
        .learnerRelease,
    ).toBe("Orbit Notes 5");

    expect(
      checkProductReading({ pages, reading: reading({ learnerRelease: "Orbit Notes 3" }) })
        .learnerRelease,
    ).toBeNull();
  });
});
