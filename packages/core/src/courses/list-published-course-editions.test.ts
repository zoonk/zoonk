import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { listPublishedCourseEditions } from "./list-published-course-editions";

describe(listPublishedCourseEditions, () => {
  it("lists every published edition in the course's family, itself included", async () => {
    const [org, family] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      prisma.courseFamily.create({ data: {} }),
    ]);

    const [english, portuguese] = await Promise.all([
      courseFixture({
        familyId: family.id,
        isPublished: true,
        language: "en",
        organizationId: org.id,
      }),
      courseFixture({
        familyId: family.id,
        isPublished: true,
        language: "pt",
        organizationId: org.id,
      }),
      courseFixture({
        familyId: family.id,
        isPublished: false,
        language: "es",
        organizationId: org.id,
      }),
    ]);

    await expect(listPublishedCourseEditions({ courseId: english.id })).resolves.toStrictEqual([
      { brandSlug: org.slug, courseSlug: english.slug, id: english.id, language: "en" },
      { brandSlug: org.slug, courseSlug: portuguese.slug, id: portuguese.id, language: "pt" },
    ]);
  });

  it("returns nothing for a course without a family", async () => {
    const course = await courseFixture({ isPublished: true });
    await expect(listPublishedCourseEditions({ courseId: course.id })).resolves.toStrictEqual([]);
  });
});
