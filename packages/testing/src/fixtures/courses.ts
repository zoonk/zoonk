import { randomUUID } from "node:crypto";
import {
  type Course,
  type CourseAlternativeTitle,
  type CourseCategory,
  type CourseUser,
  prisma,
} from "@zoonk/db";

type CourseAttrs = Omit<Course, "id" | "createdAt" | "updatedAt"> & {
  description: string;
};

export function courseAttrs(attrs?: Partial<Course>): CourseAttrs {
  const { description, ...rest } = attrs ?? {};

  return {
    description: description ?? "Test course description",
    generationRunId: null,
    generationStatus: "completed",
    imageUrl: null,
    isPublished: false,
    language: "en",
    normalizedTitle: "test course",
    organizationId: 0,
    slug: `test-course-${randomUUID()}`,
    title: "Test Course",
    ...rest,
  };
}

export async function courseFixture(attrs?: Partial<Course>) {
  const course = await prisma.course.create({ data: courseAttrs(attrs) });
  return course;
}

export async function courseCategoryFixture(attrs: Omit<CourseCategory, "id" | "createdAt">) {
  const courseCategory = await prisma.courseCategory.create({
    data: {
      category: attrs.category,
      courseId: attrs.courseId,
    },
  });
  return courseCategory;
}

export async function courseUserFixture(attrs: Omit<CourseUser, "id" | "startedAt">) {
  const courseUser = await prisma.courseUser.create({
    data: {
      courseId: attrs.courseId,
      userId: attrs.userId,
    },
  });

  return courseUser;
}

export async function courseAlternativeTitleFixture(
  attrs: Omit<CourseAlternativeTitle, "id" | "createdAt">,
) {
  return prisma.courseAlternativeTitle.create({
    data: {
      courseId: attrs.courseId,
      language: attrs.language,
      slug: attrs.slug,
    },
  });
}
