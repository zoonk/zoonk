import { randomUUID } from "node:crypto";
import {
  type Course,
  type CourseAlternativeTitle,
  type CourseCategory,
  type CourseUser,
  prisma,
} from "@zoonk/db";

export function courseAttrs(attrs?: Partial<Course>): Omit<
  Course,
  "id" | "createdAt" | "updatedAt"
> & {
  description: string;
} {
  const { description, ...rest } = attrs ?? {};

  return {
    completedAt: null,
    description: description ?? "Test course description",
    generationRunId: null,
    generationStatus: "completed",
    imageUrl: null,
    isPublished: false,
    language: "en",
    mode: "full" as const,
    normalizedTitle: "test course",
    organizationId: 0,
    slug: `test-course-${randomUUID()}`,
    targetLanguage: null,
    title: "Test Course",
    userCount: 0,
    userId: null,
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
  const [courseUser] = await prisma.$transaction([
    prisma.courseUser.create({
      data: {
        courseId: attrs.courseId,
        userId: attrs.userId,
      },
    }),
    prisma.course.update({
      data: { userCount: { increment: 1 } },
      where: { id: attrs.courseId },
    }),
  ]);

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
