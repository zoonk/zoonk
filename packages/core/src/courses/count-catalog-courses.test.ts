import { randomUUID } from "node:crypto";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { cacheTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { COURSE_LIST_CACHE_TAG } from "../cache/tags";
import { countCatalogCourses } from "./count-catalog-courses";

describe(countCatalogCourses, () => {
  it("counts the listed courses of one language, in all and per category", async () => {
    // A unique language keeps other tests' courses out of the counts.
    const [language, otherLanguage] = [randomUUID().slice(0, 10), randomUUID().slice(0, 10)];

    const [brand, school] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const listed = { isPublished: true, language, organizationId: brand.id };

    const [scienceAndTech, science, unlisted] = await Promise.all([
      courseFixture(listed),
      courseFixture(listed),
      Promise.all([
        courseFixture({ ...listed, isPublished: false }),
        courseFixture({ ...listed, visibility: "private" }),
        courseFixture({ ...listed, organizationId: school.id }),
        courseFixture({ ...listed, language: otherLanguage }),
      ]),
      // Listed without a category yet: in the total only.
      courseFixture(listed),
    ]);

    await Promise.all([
      courseCategoryFixture({ category: "science", courseId: scienceAndTech.id }),
      courseCategoryFixture({ category: "tech", courseId: scienceAndTech.id }),
      courseCategoryFixture({ category: "science", courseId: science.id }),
      ...unlisted.map((course) =>
        courseCategoryFixture({ category: "science", courseId: course.id }),
      ),
    ]);

    const result = await countCatalogCourses({ language });

    const counts = Object.fromEntries(
      result.categories.map((item) => [item.category, item.courseCount]),
    );

    expect(result.total).toBe(3);
    expect(counts).toMatchObject({ arts: 0, science: 2, tech: 1 });
    expect(result.categories).toHaveLength(COURSE_CATEGORIES.length);
    expect(cacheTag).toHaveBeenCalledWith(COURSE_LIST_CACHE_TAG);
  });
});
