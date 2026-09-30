import { randomUUID } from "node:crypto";
import { type Course, type CourseCategory, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

export async function courseFixture(attrs?: FixtureAttrs<Course, "landingPage">) {
  return prisma.course.create({
    data: {
      description: "Test course description",
      language: "en",
      normalizedTitle: "test course",
      slug: `test-course-${randomUUID()}`,
      title: "Test Course",
      ...attrs,
    },
  });
}

export async function courseCategoryFixture(attrs: Omit<CourseCategory, "id" | "createdAt">) {
  return prisma.courseCategory.create({
    data: { category: attrs.category, courseId: attrs.courseId },
  });
}
