import {
  type ProductReading,
  type ProductReleaseClaim,
} from "@zoonk/ai/tasks/research/read-product-pages";
import { describe, expect, it } from "vitest";
import { isPassageInDocument } from "../exams/passage-check";
import { parseDocument } from "../sources/parse-document";
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

/** A page research chose and verified as the product's releases page. */
function releasesPage(text: string) {
  return { isReleasesPage: true, language: "en", text };
}

function readVersions({
  pages,
  releases,
  siblingKeys = [],
}: {
  pages: Parameters<typeof checkProductReading>[0]["pages"];
  releases: ProductReleaseClaim[];
  siblingKeys?: string[];
}) {
  return checkProductReading({
    pages,
    productName: "Orbit Server",
    reading: reading({ brand: null, product: null, releases }),
    siblingKeys,
  }).releases.map((kept) => [kept.name, kept.releasedAt]);
}

describe("a release row that names only its version", () => {
  const table = `Orbit Server releases
| Version | Latest patch | Released   | End of life |
| 1.37    | 1.37.2       | 2026-09-15 | 2027-10-28  |
| 1.36    | 1.36.5       | 2026-05-12 | 2027-06-28  |
| 5       | 5.0.9        | 2019-03-01 | 2020-03-01  |`;

  const rows = [
    tableRelease("Orbit Server 1.37", "1.37", "| 1.37    | 1.37.2       | 2026-09-15 |"),
    tableRelease("Orbit Server 5", "5", "| 5       | 5.0.9        | 2019-03-01 |"),
  ];

  it("keeps a row whose version has a separator on the product's releases page, never a bare integer", () => {
    expect(readVersions({ pages: [releasesPage(table)], releases: rows })).toStrictEqual([
      ["Orbit Server 1.37", null],
    ]);
  });

  it("drops a row that names only its version on any other page", () => {
    expect(
      readVersions({ pages: [{ language: "en", text: table }], releases: rows }),
    ).toStrictEqual([]);
  });

  it("keeps a date-first row of a releases table as the parser reads it", async () => {
    const parsed = await parseDocument({
      bytes: Buffer.from(
        "<html><body><h1>Orbit Server changelog</h1><table><tr><th>Date</th><th>Version</th></tr><tr><td>2026-09-15</td><td>1.37</td></tr></table></body></html>",
      ),
      contentType: "text/html",
    });

    const text = parsed.text ?? "";
    const passage = text.split("\n").find((line) => line.includes("2026-09-15")) ?? "";

    expect(
      readVersions({
        pages: [releasesPage(text)],
        releases: [
          { ...tableRelease("Orbit Server 1.37", "1.37", passage), releasedOn: "2026-09-15" },
        ],
      }),
    ).toStrictEqual([["Orbit Server 1.37", new Date(Date.UTC(2026, 8, 15))]]);
  });

  it("keeps a bare version heading and a list item on the product's releases page", () => {
    const notes = `Orbit Server changelog
## 4.98.0  November 3, 2026
- Release 4.97.0
- Release 4.96.0`;

    expect(
      readVersions({
        pages: [releasesPage(notes)],
        releases: [
          {
            ...tableRelease("Orbit Server 4.98.0", "4.98.0", "## 4.98.0  November 3, 2026"),
            releasedOn: "2026-11-03",
          },
          tableRelease("Orbit Server 4.96.0", "4.96.0", "- Release 4.96.0"),
        ],
      }),
    ).toStrictEqual([
      ["Orbit Server 4.98.0", new Date(Date.UTC(2026, 10, 3))],
      ["Orbit Server 4.96.0", null],
    ]);
  });

  it("drops a row whose whole line on the page names another of the brand's products", () => {
    const page = `Lumen releases
| Comet Phone  | 1.37 | 2026-09-15 |
| Orbit Server | 1.36 | 2026-05-12 |`;

    expect(
      readVersions({
        pages: [releasesPage(page)],
        releases: [
          tableRelease("Orbit Server 1.37", "1.37", "| 1.37 | 2026-09-15 |"),
          tableRelease("Orbit Server 1.36", "1.36", "| 1.36 | 2026-05-12 |"),
        ],
        siblingKeys: ["cometphone"],
      }),
    ).toStrictEqual([["Orbit Server 1.36", null]]);
  });

  it("drops a quote cropped from another product's line, or one turning its space into a line break", () => {
    const page = "Comet Phone 1.37 released on 2026-09-15.\nOrbit Server 1.36 is next.";

    const quotes = ["1.37 released on 2026-09-15.", "Comet Phone\n1.37 released on 2026-09-15."];

    expect(
      readVersions({
        pages: [releasesPage(page)],
        releases: quotes.map((quote) => ({
          ...tableRelease("Orbit Server 1.37", "1.37", quote),
          releasedOn: "2026-09-15",
        })),
        siblingKeys: ["cometphone"],
      }),
    ).toStrictEqual([]);
  });

  it("drops a version row whose release names another product", () => {
    expect(
      readVersions({
        pages: [releasesPage(table)],
        releases: [
          tableRelease("Comet Phone 1.37", "1.37", "| 1.37    | 1.37.2       | 2026-09-15 |"),
        ],
      }),
    ).toStrictEqual([]);
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
