import {
  type ProductReading,
  type ProductReleaseClaim,
} from "@zoonk/ai/tasks/research/read-product-pages";
import { describe, expect, it } from "vitest";
import { isPassageInDocument } from "../exams/passage-check";
import { checkProductReading } from "./product-reading";

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
      steward: false,
    },
    learnerRelease: null,
    product: PRODUCT,
    releases: [release()],
    ...overrides,
  };
}

describe(checkProductReading, () => {
  const pages = [{ language: "en", text: PAGE }];

  it("keeps claims whose passages the page states word for word", () => {
    const checked = checkProductReading({ pages, productName: "Orbit Notes", reading: reading() });

    expect(checked.brand?.name).toBe("Lumen Works");
    expect(checked.product?.name).toBe("Orbit Notes");

    expect(checked.releases).toStrictEqual([
      {
        document: 1,
        name: "Orbit Notes 5",
        passage: "Orbit Notes 5 shipped on October 21st, 2025",
        releasedAt: new Date(Date.UTC(2025, 9, 21)),
        releasedMonthOnly: false,
        supportEndsAt: null,
        version: "5",
      },
    ]);
  });

  it("drops a release whose passage differs from the page by one word", () => {
    const checked = checkProductReading({
      pages,
      productName: "Orbit Notes",
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
      productName: "Orbit Notes",
      reading: reading({ releases: [release({ name: "Orbit Notes 6" })] }),
    });

    expect(checked.releases).toStrictEqual([]);
  });

  it("keeps only the month when its passage states the month but not the claimed day", () => {
    const checked = checkProductReading({
      pages,
      productName: "Orbit Notes",
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

    expect(checked.releases[0]).toMatchObject({
      releasedAt: new Date(Date.UTC(2024, 4, 1)),
      releasedMonthOnly: true,
    });
  });

  it("keeps a release's version only when its name and passage state it", () => {
    const checked = checkProductReading({
      pages,
      productName: "Orbit Notes",
      reading: reading({
        releases: [release(), release({ version: "999" }), release({ version: "2025" })],
      }),
    });

    expect(checked.releases.map((item) => item.version)).toStrictEqual(["5", null, null]);
  });

  it("drops an invalid calendar date", () => {
    const checked = checkProductReading({
      pages,
      productName: "Orbit Notes",
      reading: reading({ releases: [release({ releasedOn: "2025-02-30" })] }),
    });

    expect(checked.releases[0]?.releasedAt).toBeNull();
  });

  it("reads a date in the page's language", () => {
    const checked = checkProductReading({
      pages: [{ language: "pt", text: PT_PAGE }],
      productName: "Orbit Notes",
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
      productName: "Orbit Notes",
      reading: reading({
        brand: {
          description: "",
          document: 1,
          name: "Lumen Works",
          passage: "Made by Lumen Works Inc.",
          steward: false,
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

  it("drops a brand that only stewards the product", () => {
    const steward = reading().brand;

    const checked = checkProductReading({
      pages,
      productName: "Orbit Notes",
      reading: reading({ brand: steward && { ...steward, steward: true } }),
    });

    expect(checked.brand).toBeNull();
  });

  it("keeps only aliases the pages use", () => {
    const checked = checkProductReading({
      pages,
      productName: "Orbit Notes",
      reading: reading({ product: { ...PRODUCT, aliases: ["Orbit", "Orbit Pad"] } }),
    });

    expect(checked.product?.aliases).toStrictEqual(["Orbit"]);
  });

  it("keeps the learner's release only when it's among the kept releases", () => {
    expect(
      checkProductReading({
        pages,
        productName: "Orbit Notes",
        reading: reading({ learnerRelease: "Orbit Notes 5" }),
      }).learnerRelease,
    ).toBe("Orbit Notes 5");

    expect(
      checkProductReading({
        pages,
        productName: "Orbit Notes",
        reading: reading({ learnerRelease: "Orbit Notes 3" }),
      }).learnerRelease,
    ).toBeNull();
  });
});

function tableRelease(name: string, version: string, passage: string): ProductReleaseClaim {
  return { document: 1, name, passage, releasedOn: null, supportEndsOn: null, version };
}

describe("a releases table that lists versions without the product's name", () => {
  const table = `Orbit Server releases
| Version | Latest patch | Released   | End of life |
| 1.37    | 1.37.2       | 2026-09-15 | 2027-10-28  |
| 1.36    | 1.36.5       | 2026-05-12 | 2027-06-28  |
| 5       | 5.0.9        | 2019-03-01 | 2020-03-01  |`;

  it("keeps a row whose version has a separator and drops one with a bare integer", () => {
    const checked = checkProductReading({
      pages: [{ language: "en", text: table }],
      productName: "Orbit Server",
      reading: reading({
        brand: null,
        product: null,
        releases: [
          tableRelease("Orbit Server 1.37", "1.37", "| 1.37    | 1.37.2       | 2026-09-15 |"),
          tableRelease("Orbit Server 5", "5", "| 5       | 5.0.9        | 2019-03-01 |"),
        ],
      }),
    });

    expect(checked.releases.map((item) => item.name)).toStrictEqual(["Orbit Server 1.37"]);
  });

  it("drops a version that follows another product's name in its passage", () => {
    const passage = "Comet Phone 1.37 released on 2026-09-15.";

    const checked = checkProductReading({
      pages: [{ language: "en", text: `Lumen news\n${passage}\nOrbit Server 1.36 is next.` }],
      productName: "Orbit Server",
      reading: reading({
        brand: null,
        product: null,
        releases: [
          { ...tableRelease("Orbit Server 1.37", "1.37", passage), releasedOn: "2026-09-15" },
        ],
      }),
    });

    expect(checked.releases).toStrictEqual([]);
  });

  it("keeps a version that opens its line or follows the product's own name", () => {
    const notes = `Orbit Server changelog
## 4.98.0  November 3, 2026
- Release 4.97.0
- Release 4.96.0
Orbit 4.95.0 shipped with faster sync.`;

    const checked = checkProductReading({
      pages: [{ language: "en", text: notes }],
      productName: "Orbit Server",
      reading: reading({
        brand: null,
        product: {
          ...PRODUCT,
          aliases: ["Orbit"],
          name: "Orbit Server",
          passage: "Orbit Server changelog",
        },
        releases: [
          {
            ...tableRelease("Orbit Server 4.98.0", "4.98.0", "## 4.98.0  November 3, 2026"),
            releasedOn: "2026-11-03",
          },
          tableRelease("Orbit Server 4.96.0", "4.96.0", "- Release 4.97.0\n- Release 4.96.0"),
          tableRelease("Orbit Server 4.95.0", "4.95.0", "Orbit 4.95.0 shipped with faster sync."),
        ],
      }),
    });

    expect(checked.releases.map((item) => [item.name, item.releasedAt])).toStrictEqual([
      ["Orbit Server 4.98.0", new Date(Date.UTC(2026, 10, 3))],
      ["Orbit Server 4.96.0", null],
      ["Orbit Server 4.95.0", null],
    ]);
  });

  it("drops a version row whose release names another product", () => {
    const checked = checkProductReading({
      pages: [{ language: "en", text: table }],
      productName: "Orbit Server",
      reading: reading({
        brand: null,
        product: null,
        releases: [
          tableRelease("Comet Phone 1.37", "1.37", "| 1.37    | 1.37.2       | 2026-09-15 |"),
        ],
      }),
    });

    expect(checked.releases).toStrictEqual([]);
  });
});

describe("a release dated by its month", () => {
  const page = `Orbit Notes 5 shipped in October 2025 with offline sync.
Orbit Notes 4 shipped in May 2024.
Orbit Notes 3 shipped in 2023.`;

  it("keeps a month and year at month precision, never a day the passage doesn't state", () => {
    const checked = checkProductReading({
      pages: [{ language: "en", text: page }],
      productName: "Orbit Notes",
      reading: reading({
        brand: null,
        product: null,
        releases: [
          release({
            passage: "Orbit Notes 5 shipped in October 2025 with offline sync.",
            releasedOn: "2025-10",
          }),
          release({
            name: "Orbit Notes 4",
            passage: "Orbit Notes 4 shipped in May 2024.",
            releasedOn: "2024-05-04",
            version: "4",
          }),
          release({
            name: "Orbit Notes 3",
            passage: "Orbit Notes 3 shipped in 2023.",
            releasedOn: "2023-01",
            version: "3",
          }),
        ],
      }),
    });

    expect(
      checked.releases.map((item) => [item.name, item.releasedAt, item.releasedMonthOnly]),
    ).toStrictEqual([
      ["Orbit Notes 5", new Date(Date.UTC(2025, 9, 1)), true],
      ["Orbit Notes 4", new Date(Date.UTC(2024, 4, 1)), true],
      ["Orbit Notes 3", null, false],
    ]);
  });
});
