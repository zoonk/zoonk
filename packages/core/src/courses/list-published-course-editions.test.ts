import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { getCourseCacheTag } from "../cache/tags";
import { listPublishedCourseEditions } from "./list-published-course-editions";

describe(listPublishedCourseEditions, () => {
  it("lists every listed edition in the course's family, itself included, and expires with any course in it", async () => {
    const [org, family] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      prisma.courseFamily.create({ data: {} }),
    ]);

    const courses = await Promise.all([
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
      courseFixture({
        description: null,
        familyId: family.id,
        isPublished: true,
        language: "fr",
        organizationId: org.id,
      }),
    ]);

    const [english, portuguese] = courses;

    await expect(listPublishedCourseEditions({ courseId: english.id })).resolves.toStrictEqual([
      {
        brandSlug: org.slug,
        courseSlug: english.slug,
        id: english.id,
        language: "en",
        title: english.title,
      },
      {
        brandSlug: org.slug,
        courseSlug: portuguese.slug,
        id: portuguese.id,
        language: "pt",
        title: portuguese.title,
      },
    ]);

    expect(new Set(vi.mocked(cacheTag).mock.calls.flat())).toStrictEqual(
      new Set(courses.map((course) => getCourseCacheTag(course.id))),
    );
  });

  it("returns nothing for a course without a family", async () => {
    const course = await courseFixture({ isPublished: true });
    await expect(listPublishedCourseEditions({ courseId: course.id })).resolves.toStrictEqual([]);
  });
});
