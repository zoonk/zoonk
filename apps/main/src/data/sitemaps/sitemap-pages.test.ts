import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getSitemapPageIds, getSitemapPageRowIds, isSitemapPage } from "./sitemap-pages";

function listedRows(count: number): { id: string }[] {
  return Array.from({ length: count }, () => ({ id: randomUUID() }));
}

/** Which page each of `listed` is on, reading every lessons sitemap page. */
function getPageOfRows(listed: { id: string }[]): Map<string, number> {
  return new Map(
    getSitemapPageIds("library-lessons").flatMap((page) =>
      getSitemapPageRowIds({ listed, page, resource: "library-lessons" }).map(
        (id) => [id, page] as const,
      ),
    ),
  );
}

describe(getSitemapPageIds, () => {
  it("lists each sitemap's fixed pages", () => {
    expect(getSitemapPageIds("courses")).toStrictEqual([0]);
    expect(getSitemapPageIds("library-chapters")).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe(isSitemapPage, () => {
  it("accepts only the sitemap's pages", () => {
    expect(isSitemapPage({ page: 0, resource: "courses" })).toBe(true);
    expect(isSitemapPage({ page: 1, resource: "courses" })).toBe(false);
    expect(isSitemapPage({ page: 7, resource: "library-chapters" })).toBe(true);
    expect(isSitemapPage({ page: -1, resource: "library-chapters" })).toBe(false);
    expect(isSitemapPage({ page: Number.NaN, resource: "library-chapters" })).toBe(false);
  });
});

describe(getSitemapPageRowIds, () => {
  it("lists each row on exactly one page, spread evenly", () => {
    const listed = listedRows(32_000);
    const pages = getPageOfRows(listed);
    const groups = Map.groupBy(pages.values(), (page) => page);
    const sizes = [...groups.values()].map((rows) => rows.length);

    expect(pages.size).toBe(listed.length);
    expect(Math.max(...sizes)).toBeLessThan(1200);
  });

  it("keeps every row's page however many other rows join or leave the listing", () => {
    const listed = listedRows(20_000);
    const kept = listed.slice(15_000);

    const before = getPageOfRows(listed);
    const after = getPageOfRows([...kept, ...listedRows(60_000)]);

    expect(kept.filter(({ id }) => before.get(id) !== after.get(id))).toStrictEqual([]);
  });
});
