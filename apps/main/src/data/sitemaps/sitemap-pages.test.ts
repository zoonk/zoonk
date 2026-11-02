import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { describe, expect, it } from "vitest";
import { getSitemapPageIds, getSitemapPageRowIds, isSitemapPage } from "./sitemap-pages";

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
  it.each(["library-lessons", "library-chapters"] as const)(
    "queries only the stable UUID slice for %s, including unsigned suffixes",
    async (resource) => {
      const create = resource === "library-lessons" ? libraryLessonFixture : libraryChapterFixture;

      const rows = await Promise.all(
        ["00000000", "7fffffff", "80000000", "ffffffff"].map((suffix) =>
          create({ id: `${crypto.randomUUID().slice(0, -8)}${suffix}` }),
        ),
      );

      const count = getSitemapPageIds(resource).length;

      const pages = await Promise.all(
        getSitemapPageIds(resource).map((page) => getSitemapPageRowIds({ page, resource })),
      );

      for (const row of rows) {
        const page = Number.parseInt(row.id.slice(-8), 16) % count;
        expect(pages.flat().filter((id) => id === row.id)).toStrictEqual([row.id]);
        expect(pages[page]).toContain(row.id);
      }

      await create();
      const removed = rows[0]!;

      if (resource === "library-lessons") {
        await prisma.lesson.delete({ where: { id: removed.id } });
      } else {
        await prisma.chapter.delete({ where: { id: removed.id } });
      }

      await Promise.all(
        rows.slice(1).map(async (row) => {
          const page = Number.parseInt(row.id.slice(-8), 16) % count;
          await expect(getSitemapPageRowIds({ page, resource })).resolves.toContain(row.id);
        }),
      );
    },
  );
});
